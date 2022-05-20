import http from 'http';
import { Config } from '@axway/amplify-config';
import { expect } from 'chai';
import { initSDK } from '../src/index.js';
import { MemoryStore } from '@axway/amplify-sdk';

describe('auth', () => {
	before(async function () {
		this.timeout(5000);

		this.server = http.createServer((req, res) => {
			const url = new URL(req.url, 'http://127.0.0.1:1337');
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
									guid: '123',
									org_id: 123,
									name: 'foo org'
								},
								{
									guid: '456',
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

				case '/api/v1/team':
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						result: [
							{
								guid: '112233',
								name: 'Default Team',
								users: [
									{ guid: 'def456' }
								]
							}
						]
					}));
					break;

				case '/success':
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end('<html><head><title>Test successful!</title></head><body><h1>Test successful!</h1><p>You can close this browser window</p></body></html>');
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
			auth: {
				baseUrl: 'http://127.0.0.1:1337/',
				env: 'preprod',
				expires: {
					access: Date.now() + 1e6
				},
				tokens: {
					access_token: 'foo'
				}
			},
			hash: 'test:85e0419f4473118bf2bc8a8bba9f6abc',
			name: 'bar'
		};

		const tokenStore = new MemoryStore();
		await tokenStore.set(token);

		const { sdk } = await initSDK({
			baseUrl:      'http://127.0.0.1:1337/',
			clientId:     'test',
			clientSecret: 'shhhh',
			orgSelectUrl: 'http://127.0.0.1:1337/auth/org.select',
			platformUrl:  'http://127.0.0.1:1337/',
			realm:        'baz',
			tokenStore
		}, await new Config().init({ env: 'preprod' }));

		const account = await sdk.auth.find();
		expect(account).to.deep.equal(token);
	});

	it('should find an access token by id', async function () {
		this.timeout(10000);
		this.slow(9000);

		const token = {
			auth: {
				baseUrl: 'http://127.0.0.1:1337/',
				env: 'preprod',
				expires: {
					access: Date.now() + 1e6
				},
				tokens: {
					access_token: 'foo'
				}
			},
			hash: 'test:acbba128ef48ea3cb8c122225f095eb1',
			name: 'bar'
		};

		const tokenStore = new MemoryStore();
		await tokenStore.set(token);

		const { sdk } = await initSDK({
			clientId:     'test',
			env:          'preprod',
			baseUrl:      'http://127.0.0.1:1337/',
			orgSelectUrl: 'http://127.0.0.1:1337/auth/org.select',
			platformUrl:  'http://127.0.0.1:1337/',
			realm:        'baz',
			tokenStore
		}, await new Config().init());

		const account = await sdk.auth.find('test:acbba128ef48ea3cb8c122225f095eb1');
		expect(account).to.deep.equal(token);
	});

	it('should not find an access token by auth params', async () => {
		const { sdk } = await initSDK({ tokenStore: new MemoryStore() }, await new Config().init());
		const account = await sdk.auth.find();
		expect(account).to.equal(null);
	});

	it('should not find an access token by id', async () => {
		const { sdk } = await initSDK({ tokenStore: new MemoryStore() }, await new Config().init());
		const account = await sdk.auth.find('foo');
		expect(account).to.equal(null);
	});
});
