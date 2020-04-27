import http from 'http';

import { find } from '../dist/auth';
import { MemoryStore } from '@axway/amplify-auth-sdk';

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
			hash: 'test:acbba128ef48ea3cb8c122225f095eb1',
			name: 'bar'
		};

		const tokenStore = new MemoryStore();
		await tokenStore.set(token);

		const { account } = await find({
			baseUrl: 'http://127.0.0.1:1337/',
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

		const { account } = await find({
			clientId: 'test',
			env: 'preprod',
			baseUrl: 'http://127.0.0.1:1337/',
			realm: 'baz',
			tokenStore
		}, 'test:acbba128ef48ea3cb8c122225f095eb1');

		expect(account).to.deep.equal(token);
	});

	it('should not find an access token by auth params', async () => {
		const tokenStore = new MemoryStore();
		const { account } = await find({ tokenStore });
		expect(account).to.equal(undefined);
	});

	it('should not find an access token by id', async () => {
		const tokenStore = new MemoryStore();
		const { account } = await find({ tokenStore }, 'foo');
		expect(account).to.equal(undefined);
	});
});
