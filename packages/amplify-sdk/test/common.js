import bodyParser from 'koa-bodyparser';
import fs from 'fs-extra';
import http from 'http';
import jws from 'jws';
import Koa from 'koa';
import path from 'path';
import Router from '@koa/router';
import snooplogg from 'snooplogg';
import { MemoryStore } from '../dist/index';
import { v4 as uuidv4 } from 'uuid';

const { log } = snooplogg('test:amplify-auth:common');
const { highlight } = snooplogg.styles;

function createAPIRoutes(server, data) {
	const router = new Router();

	router.get('/v1/auth/findSession', async (ctx, next) => {
		const { authorization } = ctx.req.headers;
		const p = authorization ? authorization.indexOf(' ') : -1;
		const token = p !== -1 ? authorization.substring(p + 1) : null;

		log(`Finding session using token "${token}"`);

		if (token === 'platform_access_token') {
			const user = data.users.find(u => u.guid === '50000');
			const orgs = data.orgs.filter(o => o.users.find(u => u.guid === user.guid));

			ctx.body = {
				success: true,
				result: {
					org: orgs[0],
					orgs,
					user
				}
			};
		} else if (token === 'service_access_token' || token === server.accessToken) {
			ctx.body = {
				success: true,
				result: null
			};
		} else {
			await next();
		}
	});

	router.get('/v1/activity', ctx => {
		let { from, org_id, to, user_guid } = ctx.query;

		if (from) {
			from = Date.parse(from);
			if (isNaN(from)) {
				ctx.status = 400;
				ctx.body = 'Bad from date';
				return;
			}
		} else {
			from = Date.now() - (14 * 24 * 60 * 60 * 1000); // 14 days
		}

		if (to) {
			to = Date.parse(to);
			if (isNaN(to)) {
				ctx.status = 400;
				ctx.body = 'Bad to date';
				return;
			}
		} else {
			to = Date.now();
		}

		ctx.body = {
			success: true,
			result: data.activity.filter(a => {
				return a.ts >= from &&
					a.ts <= to &&
					(!org_id || String(a.org_id) === org_id) &&
					(!user_guid || a.user_guid === user_guid);
			})
		};
	});

	router.get('/v1/org/env', ctx => {
		ctx.body = {
			success: true,
			result: [
				{
					name: 'production',
					isProduction: true
				},
				{
					name: 'development',
					isProduction: false
				}
			]
		};
	});

	router.get('/v1/org/:id/family', ctx => {
		let org = data.orgs.find(o => String(o.org_id) === ctx.params.id);
		if (org?.parent_org_guid) {
			org = data.orgs.find(o => o.org_id === org.parent_org_guid);
		}
		if (org) {
			ctx.body = {
				success: true,
				result: {
					...org,
					children: org.children.map(c => data.orgs.find(o => o.guid === c))
				}
			};
		}
	});

	router.get('/v1/org/:id/usage', ctx => {
		const { id } = ctx.params;
		const org = data.orgs.find(o => String(o.org_id) === id || o.guid === id);
		if (org) {
			let { from, to } = ctx.query;

			if (from) {
				from = Date.parse(from);
				if (isNaN(from)) {
					ctx.status = 400;
					ctx.body = 'Bad from date';
					return;
				}
			} else {
				from = Date.now() - (14 * 24 * 60 * 60 * 1000); // 14 days
			}

			if (to) {
				to = Date.parse(to);
				if (isNaN(to)) {
					ctx.status = 400;
					ctx.body = 'Bad to date';
					return;
				}
			} else {
				to = Date.now();
			}

			const types = {
				apiRateMonth:      { name: 'API Calls', unit: 'Calls' },
				pushRateMonth:     { name: 'Push Notifications', unit: 'Calls' },
				storageFilesGB:    { name: 'File Storage', unit: 'GB' },
				storageDatabaseGB: { name: 'Database Storage', unit: 'GB' },
				containerPoints:   { name: 'Container Points', unit: 'Points' },
				eventRateMonth:    { name: 'Analytics Events', unit: 'Events' }
			};
			const usage = data.usage.find(u => u.org_guid === org.guid);
			const SaaS = {};

			for (const [ type, meta ] of Object.entries(types)) {
				SaaS[type] = {
					name: meta.name,
					quota: usage.quotas[type],
					value: 0,
					unit: meta.unit
				};
			}

			for (const evt of usage.events) {
				if (SaaS[evt.type] && evt.ts >= from && evt.ts <= to) {
					SaaS[evt.type].value += evt.value;
				}
			}

			ctx.body = {
				success: true,
				result: usage ? {
					...org,
					usage: { SaaS }
				} : null
			};
		}
	});

	router.get('/v1/org/:id/user', ctx => {
		let org = data.orgs.find(o => String(o.org_id) === ctx.params.id);
		if (org) {
			ctx.body = {
				success: true,
				result: org.users.reduce((users, ou) => {
					const user = data.users.find(u => u.guid === ou.guid);
					if (user) {
						users.push({
							...user,
							...ou
						});
					}
					return users;
				}, [])
			};
		}
	});

	router.post('/v1/org/:id/user', ctx => {
		let org = data.orgs.find(o => String(o.org_id) === ctx.params.id);
		if (org) {
			const { email, roles } = ctx.request.body;
			const user = data.users.find(u => u.email === email || u.guid === email);

			if (!user) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: 'User not found'
				};
				return;
			}

			if (org.users.find(u => u.guid === user.guid)) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: 'User is already a member of this org.'
				};
				return;
			}

			org.users.push({
				guid: user.guid,
				roles,
				primary: true
			})

			ctx.body = {
				success: true,
				result: { guid: user.guid }
			};
		}
	});

	router.delete('/v1/org/:id/user/:user_guid', ctx => {
		let org = data.orgs.find(o => String(o.org_id) === ctx.params.id);
		if (org) {
			const { user_guid } = ctx.params;
			const idx = org.users.findIndex(u => u.guid === user_guid);

			if (idx === -1) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: `"user_guid" contained an invalid value.`
				};
				return;
			}

			org.users.splice(idx, 1);

			ctx.body = {
				success: true,
				result: {}
			};
		}
	});

	router.put('/v1/org/:id/user/:user_guid', ctx => {
		let org = data.orgs.find(o => String(o.org_id) === ctx.params.id);
		if (org) {
			const { user_guid } = ctx.params;
			const user = org.users.find(u => u.guid === user_guid);

			if (!user) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: `"user_guid" contained an invalid value.`
				};
				return;
			}

			user.roles = ctx.request.body.roles;

			ctx.body = {
				success: true,
				result: null
			};
		}
	});

	router.get('/v1/org/:id', ctx => {
		const { id } = ctx.params;
		const org = data.orgs.find(o => String(o.org_id) === id || o.guid === id);
		if (org) {
			ctx.body = {
				success: true,
				result: org
			};
		}
	});

	router.put('/v1/org/:id', ctx => {
		const { id } = ctx.params;
		const org = data.orgs.find(o => String(o.org_id) === id || o.guid === id);
		if (org) {
			org.name = ctx.request.body.name;
			ctx.body = {
				success: true,
				result: org
			};
		}
	});

	router.get('/v1/role', ctx => {
		const { team } = ctx.query;
		ctx.body = {
			success: true,
			result: data.roles.filter(r => team ? r.team : r.org)
		};
	});

	router.delete('/v1/team/:guid/user/:user_guid', ctx => {
		const team = data.teams.find(t => t.guid === ctx.params.guid);
		if (team) {
			const idx = team.users.findIndex(u => u.guid === ctx.params.user_guid);

			if (idx === -1) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: `"user_guid" contained an invalid value.`
				};
				return;
			}

			team.users.splice(idx, 1);

			ctx.body = {
				success: true,
				result: {}
			};
		}
	});

	router.post('/v1/team/:guid/user/:user_guid', ctx => {
		const team = data.teams.find(t => t.guid === ctx.params.guid);
		if (team) {
			const user = data.users.find(u => u.guid === ctx.params.user_guid);

			if (!user) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: 'User not found'
				};
				return;
			}

			if (team.users.find(u => u.guid === user.guid)) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: 'User is already a member of this team.'
				};
				return;
			}

			if (!Array.isArray(team.users)) {
				team.users = [];
			}

			team.users.push({
				guid: user.guid,
				roles: ctx.request.body.roles,
				primary: true
			})

			ctx.body = {
				success: true,
				result: { guid: user.guid }
			};
		}
	});

	router.put('/v1/team/:guid/user/:user_guid', ctx => {
		const team = data.teams.find(t => t.guid === ctx.params.guid);
		if (team) {
			const user = team.users.find(u => u.guid === ctx.params.user_guid);

			if (!user) {
				ctx.status = 400;
				ctx.body = {
					success: false,
					message: `"user_guid" contained an invalid value.`
				};
				return;
			}

			user.roles = ctx.request.body.roles;

			ctx.body = {
				success: true,
				result: team
			};
		}
	});

	router.delete('/v1/team/:guid', ctx => {
		const idx = data.teams.findIndex(t => t.guid === ctx.params.guid);
		if (idx !== -1) {
			data.teams.splice(idx, 1);
			ctx.body = {
				success: true,
				result: {}
			};
		}
	});

	router.get('/v1/team/:guid', ctx => {
		const team = data.teams.find(t => t.guid === ctx.params.guid);
		if (team) {
			ctx.body = {
				success: true,
				result: team
			};
		}
	});

	router.put('/v1/team/:guid', ctx => {
		const team = data.teams.find(t => t.guid === ctx.params.guid);
		if (team) {
			const info = ctx.request.body;

			if (info.name !== undefined) {
				team.name = info.name;
			}
			if (info.default !== undefined) {
				team.default = !!info.default;
			}
			if (info.desc !== undefined) {
				team.desc = info.desc;
			}
			if (info.tags !== undefined) {
				team.tags = info.tags;
			}

			ctx.body = {
				success: true,
				result: team
			};
		}
	});

	router.get('/v1/team', ctx => {
		let { teams } = data;

		const { name, org_id } = ctx.query;
		if (org_id) {
			const org = data.orgs.find(o => String(o.org_id) === org_id);
			if (!org) {
				return;
			}
			teams = teams.filter(t => t.org_guid === org.guid &&
				(!name || t.name.toLowerCase().includes(String(name).trim().toLowerCase())));
		}

		ctx.body = {
			success: true,
			result: teams
		};
	});

	router.post('/v1/team', ctx => {
		const info = ctx.request.body
		const org = data.orgs.find(o => o.guid === info.org_guid);

		if (!org) {
			throw new Error('Org not found');
		}

		const team = {
			name:     info.name,
			guid:     uuidv4(),
			default:  info.default === undefined ? true : !!info.default,
			desc:     info.desc,
			tags:     info.tags === undefined ? [] : info.tags,
			org_guid: info.org_guid,
			users:    []
		};

		data.teams.push(team);

		ctx.body = {
			success: true,
			result: team
		};
	});

	router.put('/v1/user/profile/:id', ctx => {
		const { id } = ctx.params;
		const user = data.users.find(u => u.guid === id);
		if (user) {
			const { firstname, lastname, phone } = ctx.request.body;

			if (firstname) {
				user.firstname = firstname;
			}
			if (lastname) {
				user.lastname = lastname;
			}
			if (phone) {
				user.phone = phone;
			}

			ctx.body = {
				success: true,
				result: user
			};
		}
	});

	router.get('/v1/user/:id', ctx => {
		const { id } = ctx.params;
		const user = data.users.find(u => u.guid === id);
		if (user) {
			ctx.body = {
				success: true,
				result: user
			};
		}
	});

	router.get('/v1/user', ctx => {
		const { term } = ctx.query;
		if (term) {
			ctx.body = {
				success: true,
				result: data.users.filter(u => u.email === term)
			};
		}
	});

	return router.routes();
}

function createAuthRoutes(server) {
	const router = new Router();
	let counter = 0;

	router.get('/realms/test_realm/protocol/openid-connect/userinfo', ctx => {
		ctx.body = {
			name: `tester${counter}`,
			email: 'foo@bar.com'
		};
	});

	router.get('/realms/test_realm/protocol/openid-connect/auth', ctx => {
		const { redirect_uri } = ctx.query;
		if (!redirect_uri) {
			throw new Error('No redirect uri!');
		}
		ctx.redirect(`${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}code=123456`);
	});

	router.post('/realms/test_realm/protocol/openid-connect/token', ctx => {
		server.accessToken = jws.sign({
			header: { alg: 'HS256' },
			payload: { email: 'foo@bar.com' },
			secret: `access${counter}`
		});

		server.refreshToken = jws.sign({
			header: { alg: 'HS256' },
			payload: { email: 'foo@bar.com' },
			secret: `refresh${counter}`
		});

		ctx.body = {
			access_token:       server.accessToken,
			refresh_token:      server.refreshToken,
			expires_in:         10,
			refresh_expires_in: 10
		};
	});

	router.get('/realms/test_realm/protocol/openid-connect/logout', ctx => {
		ctx.body = 'OK';
	});

	router.get('/realms/test_realm/protocol/openid-connect/userinfo', ctx => {
		ctx.body = {
			name: `tester${counter}`,
			email: 'foo@bar.com'
		};
	});

	router.get('/realms/test_realm/.well-known/openid-configuration', ctx => {
		ctx.body = JSON.parse(fs.readFileSync(path.join(__dirname, 'server-info.json')));
	});

	return router.routes();
}

export function createServer(opts = {}) {
	return new Promise((resolve, reject) => {
		const connections = {};
		const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json')));
		const router = new Router();
		const server = new Koa()
			.use(bodyParser())
			.use(async (ctx, next) => {
				log(`Incoming request: ${highlight(`${ctx.method} ${ctx.url}`)}`);
				await next();
			})
			.use(router.routes())
			.listen(1337, '127.0.0.1')
			.on('connection', conn => {
				const key = conn.remoteAddress + ':' + conn.remotePort;
				log(`${highlight(key)} connected`);
				connections[key] = conn;
				conn.on('close', () => {
					delete connections[key];
					log(`${highlight(key)} disconnected`);
				});
			})
			.on('listening', () => {
				log('Started test server: http://127.0.0.1:1337');
				resolve(server);
			})
			.on('error', reject);

		router.use('/api', createAPIRoutes(server, data));
		router.use('/auth', createAuthRoutes(server, data));

		router.get([ '/', '/success' ], ctx => {
			ctx.body = `<html>
<head>
	<title>Test successful!</title>
</head>
<body>
	<h1>Test successful!</h1>
	<p>You can close this browser window</p>
	<script>
	let u = new URL(location.href);
	let m = u.hash && u.hash.match(/redirect=(.+)/);
	if (m) {
		location.href = decodeURIComponent(m[1]);
	}
	</script>
</body>
</html>`;
		});

		server.createTokenStore = (opts = {}) => {
			const user = data.users.find(u => u.guid === (opts.userGuid || '50000'));
			const orgs = data.orgs.filter(o => o.users.find(u => u.guid === user.guid));
			const account = JSON.parse(JSON.stringify({
				auth: {
					baseUrl: 'http://127.0.0.1:1337',
					expires: {
						access: Date.now() + 1e6,
						refresh: Date.now() + 1e6,
						...opts.expires
					},
					tokens: {
						access_token: 'platform_access_token',
						refresh_token: 'platform_refresh_token',
						...opts.tokens
					}
				},
				name: 'test_client:foo@bar.com',
				org: orgs[0],
				orgs: orgs.map(o => {
					const r = { ...o };
					r.id = r.org_id;
					delete r.org_id;
					return r;
				}),
				user
			}));

			account.isPlatform = account.auth.tokens.access_token !== 'service_account';

			Object.defineProperty(account.auth, 'expired', {
				configurable: true,
				get() {
					return this.expires.access < Date.now();
				}
			});

			const tokenStore = new MemoryStore();
			tokenStore.set(account);

			return { account, tokenStore };
		};

		server.destroy = async () => {
			for (const conn of Object.values(connections)) {
				conn.destroy();
			}
			await new Promise(resolve => server.close(resolve));
		};
	});
}

export async function createLoginServer(opts = {}) {
	let counter = 0;

	const handler = opts.handler || (async (req, res) => {
		try {
			const url = new URL(req.url, 'http://127.0.0.1:1337');

			let post = {};
			if (req.method === 'POST') {
				post = await new Promise((resolve, reject) => {
					const body = [];
					req.on('data', chunk => body.push(chunk));
					req.on('error', reject);
					req.on('end', () => resolve(Array.from(new URLSearchParams(Buffer.concat(body).toString()).entries()).reduce((p, [k,v]) => (p[k]=v,p), {})));
				});
			}

			counter++;

			log(`Incoming request: ${highlight(url.pathname)}`);

			switch (url.pathname) {
				case '/auth/realms/test_realm/protocol/openid-connect/auth':
					if (typeof opts.auth === 'function') {
						opts.auth(post, req, res);
					}

					const redirect_uri = url.searchParams.get('redirect_uri');
					if (!redirect_uri) {
						throw new Error('No redirect uri!');
					}

					res.writeHead(301, {
						Location: `${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}code=123456`
					});
					res.end();
					break;

				case '/auth/realms/test_realm/protocol/openid-connect/token':
					if (typeof opts.token === 'function') {
						opts.token(post, req, res);
					}

					server.accessToken = jws.sign({
						header: { alg: 'HS256' },
						payload: opts.payload || { email: 'foo@bar.com' },
						secret: `access${counter}`
					});

					server.refreshToken = jws.sign({
						header: { alg: 'HS256' },
						payload: opts.payload || { email: 'foo@bar.com' },
						secret: `refresh${counter}`
					});

					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						access_token:       server.accessToken,
						refresh_token:      server.refreshToken,
						expires_in:         opts.expiresIn || 10,
						refresh_expires_in: opts.refreshExpiresIn || 10
					}));
					break;

				case '/auth/realms/test_realm/protocol/openid-connect/logout':
					if (typeof opts.logout === 'function') {
						opts.logout(post, req, res);
					}

					res.writeHead(200, { 'Content-Type': 'text/plain' });
					res.end('OK');
					break;

				case '/auth/realms/test_realm/protocol/openid-connect/userinfo':
					if (typeof opts.userinfo === 'function' && opts.userinfo(post, req, res)) {
						break;
					}

					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						name: `tester${counter}`,
						email: 'foo@bar.com'
					}));
					break;

				case '/auth/realms/test_realm/.well-known/openid-configuration':
					if (typeof opts.serverinfo === 'function' && opts.serverinfo(post, req, res)) {
						break;
					}

					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(fs.readFileSync(path.join(__dirname, 'server-info.json')));
					break;

				case '/':
				case '/success':
				case '/success/':
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end(`<html>
<head>
	<title>Test successful!</title>
</head>
<body>
	<h1>Test successful!</h1>
	<p>You can close this browser window</p>
	<script>
	let u = new URL(location.href);
	let m = u.hash && u.hash.match(/redirect=(.+)/);
	if (m) {
		location.href = decodeURIComponent(m[1]);
	}
	</script>
</body>
</html>`);
					break;
			}
		} catch (e) {
			res.writeHead(400, { 'Content-Type': 'text/plain' });
			res.end(e.toString());
		}
	});

	const server = http.createServer(handler);
	const connections = {};

	server.destroy = () => {
		return Promise.all([
			new Promise(resolve => server.close(resolve)),
			new Promise(resolve => {
				for (const conn of Object.values(connections)) {
					conn.destroy();
				}
				resolve();
			})
		]);
	};

	await new Promise((resolve, reject) => {
		server
			.on('listening', resolve)
			.on('connection', conn => {
				const key = `${conn.remoteAddress}:${conn.remotePort}`;
				connections[key] = conn;
				conn.on('close', () => {
					delete connections[key];
				});
			})
			.on('error', reject)
			.listen(1337, '127.0.0.1');
	});

	log('Started test server: http://127.0.0.1:1337');

	return server;
}

export async function stopServer() {
	this.timeout(5000);

	// we need to wait 1 second because after logging in, the browser is redirect to platform and
	// even though this is a test, we should avoid the browser erroring because we killed the
	// server too soon
	await new Promise(resolve => setTimeout(resolve, 1000));

	if (this.server) {
		log('Destroying test auth server...');
		await this.server.destroy();
		this.server = null;
	}

	if (this.tempFile && fs.existsSync(this.tempFile)) {
		fs.removeSync(this.tempFile);
	}
	this.tempFile = null;
}

export { stopServer as stopLoginServer };
