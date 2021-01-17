import fs from 'fs-extra';
import http from 'http';
import jws from 'jws';
import snooplogg from 'snooplogg';

import { serverInfo } from './server-info';

const { log } = snooplogg('test:amplify-auth:common');
const { highlight } = snooplogg.styles;

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
					res.end(JSON.stringify(serverInfo));
					break;

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

				default:
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not Found');
			}
		} catch (e) {
			console.log(e);
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

export async function stopLoginServer() {
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
