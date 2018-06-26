import Auth, { internal } from '../dist/index';
import http from 'http';
import jws from 'jws';
import querystring from 'querystring';

import { parse } from 'url';

const { Authenticator, ClientSecret } = internal;

describe('Client Secret', () => {
	describe('Constructor', () => {
		it('should error if options is invalid', () => {
			expect(() => {
				new ClientSecret();
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if client secret is invalid', () => {
			expect(() => {
				new ClientSecret({});
			}).to.throw(TypeError, 'Expected client secret to be a non-empty string');

			expect(() => {
				new ClientSecret({ clientSecret: null });
			}).to.throw(TypeError, 'Expected client secret to be a non-empty string');

			expect(() => {
				new ClientSecret({ clientSecret: '' });
			}).to.throw(TypeError, 'Expected client secret to be a non-empty string');
		});
	});

	describe('Authorization URL', () => {
		it('should generate a authorization URL for a service account', () => {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: true,

				baseUrl: '<URL>',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			expect(auth.authenticator.authorizationUrl).to.equal('<URL>/auth/realms/test_realm/protocol/openid-connect/auth?access_type=offline&client_id=test_client&grant_type=client_credentials&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fcallback&response_type=code&scope=openid');
		});

		it('should generate a authorization URL for a non-service account', () => {
			const auth = new Auth({
				clientSecret: '###',

				baseUrl: '<URL>',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			expect(auth.authenticator.authorizationUrl).to.equal('<URL>/auth/realms/test_realm/protocol/openid-connect/auth?access_type=offline&client_id=test_client&grant_type=authorization_code&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fcallback&response_type=code&scope=openid');
		});
	});

	describe('Access Token', async () => {
		it('should fail getting an access token if not logged in', async () => {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: false,

				baseUrl: '<URL>',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			try {
				await auth.getAccessToken();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Login required');
				return;
			}

			throw new Error('Expected error');
		});
	});

	describe('Login/Logout', () => {
		afterEach(async function () {
			if (this.server) {
				await new Promise(resolve => this.server.close(resolve));
				this.server = null;
			}
		});

		it('should retrieve a URL for an interactive headless flow', async () => {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: false,
				baseUrl: '<URL>',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			const { url } = await auth.login({ headless: true });
			expect(url).to.equal('<URL>/auth/realms/test_realm/protocol/openid-connect/auth?access_type=offline&client_id=test_client&grant_type=authorization_code&redirect_uri=http%3A%2F%2F127.0.0.1%3A3000%2Fcallback&response_type=code&scope=openid');
		});

		it('should error if getting token without a code', async () => {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: false,
				baseUrl: '<URL>',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			try {
				await auth.authenticator.getToken();
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected code for interactive authentication to be a non-empty string');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate using code, then logout', async function () {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: false,
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test'
			});

			let counter = 0;

			this.server = http.createServer(async (req, res) => {
				try {
					const url = parse(req.url);
					expect(req.method).to.equal('POST');

					const post = await new Promise((resolve, reject) => {
						const body = [];
						req.on('data', chunk => body.push(chunk));
						req.on('error', reject);
						req.on('end', () => resolve(querystring.parse(Buffer.concat(body).toString())));
					});

					switch (url.pathname) {
						case '/auth/realms/test_realm/protocol/openid-connect/token':
							switch (++counter) {
								case 1:
									expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
									expect(post.client_secret).to.equal('###');
									break;

								case 2:
									expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
									expect(post.refresh_token).to.equal('bar1');
									break;
							}

							res.writeHead(200, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({
								access_token:       accessToken,
								refresh_token:      `bar${counter}`,
								expires_in:         10,
								refresh_expires_in: 600
							}));
							break;

						case '/auth/realms/test_realm/protocol/openid-connect/logout':
							expect(post.refresh_token).to.equal('bar2');
							res.writeHead(200, { 'Content-Type': 'text/plain' });
							res.end('OK');
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

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const result = await auth.authenticator.getToken('foo');
			expect(result).to.equal(accessToken);

			expect(auth.authenticator.email).to.equal('foo@bar.com');

			const expires = auth.expiresIn;
			expect(expires).to.not.be.null;
			const target = Date.now() + 10000;
			expect(expires).to.be.within(target - 100, target + 100);

			await auth.logout();

			expect(auth.authenticator.email).to.be.null;
			expect(auth.authenticator.expires).to.deep.equal({
				access: null,
				refresh: null
			});
			expect(auth.authenticator.tokens).to.deep.equal({});
		});

		it('should fail if code is incorrect', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(401, { 'Content-Type': 'text/plain' });
				res.end('Unauthorized');
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const auth = new Auth({
				clientSecret: '###',
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			try {
				await auth.authenticator.getToken('foo');
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Unauthorized');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if server is unreachable', async () => {
			const auth = new Auth({
				clientSecret: '###',
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			try {
				await auth.authenticator.getToken('foo');
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/^request to .+ failed,/i);
				expect(e.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server returns invalid user identity', async function () {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: false,
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: { email: '' },
				secret: 'test'
			});

			this.server = http.createServer((req, res) => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({
					access_token:       accessToken,
					refresh_token:      'bar',
					expires_in:         600,
					refresh_expires_in: 600
				}));
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			try {
				await auth.authenticator.getToken('foo');
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: invalid response from server');
				return;
			}

			throw new Error('Expected error');
		});

		it('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			let accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test1'
			});

			let counter = 0;

			this.server = http.createServer(async (req, res) => {
				try {
					expect(req.method).to.equal('POST');

					const post = await new Promise((resolve, reject) => {
						const body = [];
						req.on('data', chunk => body.push(chunk));
						req.on('error', reject);
						req.on('end', () => resolve(querystring.parse(Buffer.concat(body).toString())));
					});

					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.ClientCredentials);
							expect(post.client_secret).to.equal('###');
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal('bar1');
							break;
					}

					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						access_token:       accessToken,
						refresh_token:      `bar${counter}`,
						expires_in:         1,
						refresh_expires_in: 600
					}));
				} catch (e) {
					res.writeHead(400, { 'Content-Type': 'text/plain' });
					res.end(e.toString());
				}
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: true,
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			let results = await auth.authenticator.getToken('foo');
			expect(results).to.equal(accessToken);

			await new Promise(resolve => setTimeout(resolve, 2000));

			accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test2'
			});

			results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);
		});

		it('should not error logging out if not logged in', async function () {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: false,
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			let counter = 0;

			this.server = http.createServer(async (req, res) => {
				try {
					const url = parse(req.url);
					expect(req.method).to.equal('POST');

					const post = await new Promise((resolve, reject) => {
						const body = [];
						req.on('data', chunk => body.push(chunk));
						req.on('error', reject);
						req.on('end', () => resolve(querystring.parse(Buffer.concat(body).toString())));
					});

					switch (url.pathname) {
						case '/auth/realms/test_realm/protocol/openid-connect/logout':
							counter++;
							expect(post.refresh_token).to.be.ok;
							res.writeHead(200, { 'Content-Type': 'text/plain' });
							res.end('OK');
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

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			await auth.logout();

			expect(auth.authenticator.email).to.be.null;
			expect(auth.authenticator.expires).to.deep.equal({
				access: null,
				refresh: null
			});
			expect(auth.authenticator.tokens).to.deep.equal({});
			expect(counter).to.equal(0);
		});
	});

	describe('User Info', () => {
		afterEach(async function () {
			if (this.server) {
				await new Promise(resolve => this.server.close(resolve));
				this.server = null;
			}
		});

		it('should login and get user info', async function () {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: true,
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test'
			});

			let counter = 0;

			this.server = http.createServer((req, res) => {
				const url = parse(req.url);

				switch (url.pathname) {
					case '/auth/realms/test_realm/protocol/openid-connect/token':
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({
							access_token:       accessToken,
							refresh_token:      'bar',
							expires_in:         10,
							refresh_expires_in: 600
						}));
						break;

					case '/auth/realms/test_realm/protocol/openid-connect/userinfo':
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({
							name: `tester${++counter}`,
							email: 'foo@bar.com'
						}));
						break;

					default:
						res.writeHead(404, { 'Content-Type': 'text/plain' });
						res.end('Not Found');
				}
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			let info = await auth.userInfo();
			expect(info).to.deep.equal({
				name: 'tester1',
				email: 'foo@bar.com'
			});

			info = await auth.userInfo();
			expect(info).to.deep.equal({
				name: 'tester2',
				email: 'foo@bar.com'
			});
		});

		it('should handle bad user info response', async function () {
			const auth = new Auth({
				clientSecret: '###',
				serviceAccount: true,
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test'
			});

			this.server = http.createServer((req, res) => {
				const url = parse(req.url);

				switch (url.pathname) {
					case '/auth/realms/test_realm/protocol/openid-connect/token':
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({
							access_token:       accessToken,
							refresh_token:      'bar',
							expires_in:         10,
							refresh_expires_in: 600
						}));
						break;

					case '/auth/realms/test_realm/protocol/openid-connect/userinfo':
						res.writeHead(200, { 'Content-Type': 'text/plain' });
						res.end('{{{{{{');
						break;

					default:
						res.writeHead(404, { 'Content-Type': 'text/plain' });
						res.end('Not Found');
				}
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			try {
				await auth.userInfo();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/^invalid json response body at /i);
				return;
			}

			throw new Error('Expected error');
		});
	});
});
