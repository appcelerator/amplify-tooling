import http from 'http';

import { getAccount } from '../dist/auth';
import { MemoryStore } from '@axway/amplify-auth-sdk';
import { parse } from 'url';

describe('auth', () => {
	before(async function () {
		this.timeout(5000);

		this.server = http.createServer((req, res) => {
			const url = parse(req.url);
			switch (url.pathname) {
				case '/auth/realms/AppcID/protocol/openid-connect/userinfo':
				case '/auth/realms/Axway/protocol/openid-connect/userinfo':
				case '/auth/realms/baz/protocol/openid-connect/userinfo':
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						name: 'bar',
						email: 'foo@bar.com'
					}));
					break;

				case '/api/v1/auth/findSession':
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

				default:
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not Found');
			}
		});

		this.connections = {};

		await new Promise((resolve, reject) => {
			this.server
				.on('listening', resolve)
				.on('connection', conn => {
					const key = `${conn.remoteAddress}:${conn.remotePort}`;
					this.connections[key] = conn;
					conn.on('close', () => {
						delete this.connections[key];
					});
				})
				.on('error', reject)
				.listen(1337, '127.0.0.1');
		});
	});

	after(function () {
		return Promise.all([
			new Promise(resolve => this.server.close(resolve)),
			new Promise(resolve => {
				for (const conn of Object.values(this.connections)) {
					conn.destroy();
				}
				resolve();
			})
		]);
	});

	it('should find an access token by auth params', async function () {
		this.timeout(10000);
		this.slow(9000);

		const token = {
			baseUrl: 'http://localhost:1337/',
			env: 'preprod',
			hash: 'test:509283ae0179a444c6e32408220800db',
			name: 'bar',
			expires: {
				access: Date.now() + 1e6
			},
			tokens: {
				access_token: 'foo'
			}
		};

		const tokenStore = new MemoryStore();
		await tokenStore.set(token);

		const { account } = await getAccount({
			baseUrl: 'http://localhost:1337/',
			platformUrl: 'http://localhost:1337/',
			clientId: 'test',
			clientSecret: 'shhhh',
			realm: 'baz',
			tokenStore
		});

		expect(account).to.deep.equal(token);
	});

	it('should find an access token by id', async function () {
		this.timeout(10000);
		this.slow(9000);

		const token = {
			baseUrl: 'http://localhost:1337/',
			env: 'preprod',
			hash: 'test:509283ae0179a444c6e32408220800db',
			name: 'bar',
			expires: {
				access: Date.now() + 1e6
			},
			tokens: {
				access_token: 'foo'
			}
		};

		const tokenStore = new MemoryStore();
		await tokenStore.set(token);

		const { account } = await getAccount({
			baseUrl: 'http://localhost:1337/',
			platformUrl: 'http://localhost:1337/',
			tokenStore
		}, 'test:509283ae0179a444c6e32408220800db');

		expect(account).to.deep.equal(token);
	});

	it('should not find an access token by auth params', async () => {
		const tokenStore = new MemoryStore();
		const { account } = await getAccount({ tokenStore });
		expect(account).to.equal(undefined);
	});

	it('should not find an access token by id', async () => {
		const tokenStore = new MemoryStore();
		const { account } = await getAccount({ tokenStore }, 'foo');
		expect(account).to.equal(undefined);
	});
});
