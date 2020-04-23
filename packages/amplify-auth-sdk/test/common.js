import fs from 'fs-extra';
import http from 'http';
import jws from 'jws';
import snooplogg from 'snooplogg';

import { parse } from 'url';
import { server } from '../dist/index';
import { serverInfo } from './server-info';

const { log } = snooplogg('test:amplify-auth:common');

export async function createLoginServer(opts = {}) {
	let counter = 0;

	const handler = opts.handler || (async (req, res) => {
		try {
			const url = parse(req.url);
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

			switch (url.pathname) {
				case '/auth/realms/test_realm/protocol/openid-connect/auth':
					if (typeof opts.auth === 'function') {
						opts.auth(post, req, res);
					}

					const redirect_uri = new URLSearchParams(url.query).get('redirect_uri');
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
					if (typeof opts.userinfo === 'function') {
						if (opts.userinfo(post, req, res)) {
							break;
						}
					}

					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						name: `tester${counter}`,
						email: 'foo@bar.com'
					}));
					break;

				case '/auth/realms/test_realm/.well-known/openid-configuration':
					if (typeof opts.serverinfo === 'function') {
						if (opts.serverinfo(post, req, res)) {
							break;
						}
					}

					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify(serverInfo));
					break;

				case '/api/v1/auth/findSession':
					if (typeof opts.findSession === 'function') {
						if (opts.findSession(post, req, res)) {
							break;
						}
					}

					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						result: {
							org: {
								org_id: 123,
								name: 'foo org'
							},
							orgs: [
								{
									org_id: 123,
									name: 'foo org'
								},
								{
									org_id: 456,
									name: 'bar org'
								}
							],
							user: {
								axway_id: 'abc123',
								email: 'foo@bar.com',
								firstname: 'foo',
								guid: 'def456',
								lastname: 'bar',
								organization: 'foo org'
							}
						}
					}));
					break;

				case '/api/v1/auth/switchLoggedInOrg':
					if (typeof opts.switchLoggedInOrg === 'function') {
						if (opts.switchLoggedInOrg(post, req, res)) {
							break;
						}
					}

					res.writeHead(200, { 'Content-Type': 'application/json' });
					if (post.org_id === 456) {
						res.end(JSON.stringify({
							result: {
								org_name: 'bar org',
								org_id: 456
							}
						}));
					} else {
						res.end(JSON.stringify({
							result: {
								org_name: 'foo org',
								org_id: 123
							}
						}));
					}
					break;

				default:
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not Found');
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

	return server;
}

export async function stopLoginServer() {
	this.timeout(5000);

	await server.stop(true);

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
