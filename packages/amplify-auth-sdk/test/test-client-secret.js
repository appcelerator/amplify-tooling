import Auth, { internal } from '../dist/index';

import { createLoginServer, stopLoginServer } from './common';

const { Authenticator, ClientSecret } = internal;

const isCI = process.env.CI || process.env.JENKINS;

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

	describe('Login', () => {
		afterEach(stopLoginServer);

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
				await auth.getToken();
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected code for interactive authentication to be a non-empty string');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate using code', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				expiresIn: 10,
				token(post) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
							expect(post.client_secret).to.equal('###');
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal(this.server.refreshToken);
							break;
					}
				},
				logout(post) {
					expect(post.refresh_token).to.equal('bar2');
				}
			});

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			const result = await auth.getToken('foo');
			expect(result).to.equal(this.server.accessToken);

			expect(auth.authenticator.email).to.equal('foo@bar.com');

			const expires = auth.expiresIn;
			expect(expires).to.not.be.null;
			const target = Date.now() + 10000;
			expect(expires).to.be.within(target - 100, target + 100);
		});

		it('should timeout during interactive login', async function () {
			this.server = await createLoginServer();

			try {
				const auth = new Auth({
					clientSecret:   '###',
					serviceAccount: false,
					baseUrl:        'http://127.0.0.1:1337',
					clientId:       'test_client',
					realm:          'test_realm'
				});
				await auth.login({ timeout: 100 });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication timed out');
				expect(e.toString()).to.equal('ERR_AUTH_TIMEOUT');
				return;
			}

			throw new Error('Expected error');
		});

		(isCI ? it.skip : it)('should do interactive login', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			this.server = await createLoginServer();

			const result = await auth.login();
			expect(result.accessToken).to.equal(this.server.accessToken);
		});

		it('should fail if code is incorrect', async function () {
			this.server = await createLoginServer({
				handler(req, res) {
					res.writeHead(401, { 'Content-Type': 'text/plain' });
					res.end('Unauthorized');
				}
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

			this.server = await createLoginServer({
				handler(req, res) {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						refresh_token:      'bar',
						expires_in:         600,
						refresh_expires_in: 600
					}));
				}
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

			let counter = 0;

			this.server = await createLoginServer({
				expiresIn: 1,
				token: post => {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.ClientCredentials);
							expect(post.client_secret).to.equal('###');
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal(this.server.refreshToken);
							break;
					}
				}
			});

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			let results = await auth.getToken('foo');
			expect(results).to.equal(this.server.accessToken);

			await new Promise(resolve => setTimeout(resolve, 1200));

			results = await auth.login();
			expect(results.accessToken).to.equal(this.server.accessToken);
		});
	});

	describe('Logout', () => {
		afterEach(stopLoginServer);

		it('should log out', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				expiresIn: 10,
				token(post) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
							expect(post.client_secret).to.equal('###');
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal(this.server.refreshToken);
							break;
					}
				},
				logout(post) {
					expect(post.refresh_token).to.equal('bar2');
				}
			});

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			const result = await auth.getToken('foo');
			expect(result).to.equal(this.server.accessToken);

			expect(auth.authenticator.email).to.equal('foo@bar.com');

			await auth.logout();

			expect(auth.authenticator.email).to.be.null;
			expect(auth.authenticator.expires).to.deep.equal({
				access: null,
				refresh: null
			});
			expect(auth.authenticator.tokens).to.deep.equal({});
		});

		it('should not error logging out if not logged in', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			let counter = 0;

			this.server = await createLoginServer({
				logout(post) {
					counter++;
					expect(post.refresh_token).to.be.ok;
				}
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
		afterEach(stopLoginServer);

		it('should error if not logged in', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			this.server = await createLoginServer();

			try {
				await auth.userInfo();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Login required');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if logging in interactively', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			this.server = await createLoginServer();

			try {
				await auth.userInfo(true);
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Login required');
				return;
			}

			throw new Error('Expected error');
		});

		it('should get user info', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm'
			});

			this.server = await createLoginServer();

			await auth.getToken('foo');

			let info = await auth.userInfo();
			expect(info).to.deep.equal({
				name: 'tester2',
				email: 'foo@bar.com'
			});

			info = await auth.userInfo();
			expect(info).to.deep.equal({
				name: 'tester3',
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

			this.server = await createLoginServer({
				userinfo(post, req, res) {
					res.writeHead(200, { 'Content-Type': 'text/plain' });
					res.end('{{{{{{');
					return true;
				}
			});

			await auth.getToken('foo');

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
