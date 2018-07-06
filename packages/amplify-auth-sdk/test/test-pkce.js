/* eslint-disable max-len */

import Auth, { Authenticator } from '../dist/index';

import { createLoginServer, stopLoginServer } from './common';

const isCI = process.env.CI || process.env.JENKINS;

describe('PKCE', () => {
	describe('Access Token', async () => {
		afterEach(stopLoginServer);

		it('should error getting an access token if not logged in', async function () {
			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.getAccessToken();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Login required');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error attempting to automatically login and get token', async function () {
			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.getAccessToken(true);
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

		it('should retrieve a URL for an interactive headless flow', async function () {
			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			const { cancel, url } = await this.auth.login({ headless: true });
			await cancel();
			expect(url).to.match(/^http:\/\/127\.0\.0\.1:1337\/auth\/realms\/test_realm\/protocol\/openid-connect\/auth\?access_type=offline&client_id=test_client&code_challenge=.+&code_challenge_method=S256&grant_type=authorization_code&redirect_uri=http%3A%2F%2F127\.0\.0\.1%3A3000%2Fcallback%2F.+&response_type=code&scope=openid$/);
		});

		it('should error if getting token without a code', async function () {
			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.getToken();
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected code for interactive authentication to be a non-empty string');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if code is incorrect', async function () {
			this.server = await createLoginServer({
				handler(req, res) {
					res.writeHead(401, { 'Content-Type': 'text/plain' });
					res.end('Unauthorized');
				}
			});

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.getToken('foo');
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Unauthorized');
				return;
			}

			throw new Error('Expected error');
		});

		it('should timeout during interactive login', async function () {
			this.server = await createLoginServer();

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.login({ app: [ 'echo', 'hi' ], timeout: 100 });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication timed out');
				expect(e.toString()).to.equal('ERR_AUTH_TIMEOUT');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate using code', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				token(post) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
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

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			const result = await this.auth.getToken('foo');
			expect(result).to.equal(this.server.accessToken);

			expect(this.auth.authenticator.email).to.equal('foo@bar.com');

			const expires = this.auth.expiresIn;
			expect(expires).to.not.be.null;
			const target = Date.now() + 10000;
			expect(expires).to.be.within(target - 100, target + 100);
		});

		it('should error if server is unreachable', async function () {
			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.getToken('foo');
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/^request to .+ failed,/i);
				expect(e.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server returns invalid user identity', async function () {
			this.server = await createLoginServer({
				handler(req, res) {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						// no access token!
						refresh_token:      'bar',
						expires_in:         600,
						refresh_expires_in: 600
					}));
				}
			});

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.getToken('foo');
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: invalid response from server');
				return;
			}

			throw new Error('Expected error');
		});

		(isCI ? it.skip : it)('should do interactive login', async function () {
			this.server = await createLoginServer();

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			const result = await this.auth.login();
			expect(result.accessToken).to.equal(this.server.accessToken);

			expect(this.auth.authenticator.email).to.equal('foo@bar.com');
		});

		(isCI ? it.skip : it)('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			let counter = 0;

			this.server = await createLoginServer({
				expiresIn: 1,
				token: post => {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal(this.server.refreshToken);
							break;
					}
				}
			});

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			let results = await this.auth.getToken('foo');
			expect(results).to.equal(this.server.accessToken);

			await new Promise(resolve => setTimeout(resolve, 1200));

			results = await this.auth.login();
			expect(results.accessToken).to.equal(this.server.accessToken);
		});
	});

	describe('Logout', () => {
		afterEach(stopLoginServer);

		it('should log out', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				token(post) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
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

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			await this.auth.getToken('foo');

			expect(this.auth.authenticator.email).to.equal('foo@bar.com');
			expect(this.auth.authenticator.expires.access).to.not.be.null;
			expect(this.auth.authenticator.expires.refresh).to.not.be.null;

			await this.auth.logout();

			expect(this.auth.authenticator.email).to.be.null;
			expect(this.auth.authenticator.expires).to.deep.equal({
				access: null,
				refresh: null
			});
			expect(this.auth.authenticator.tokens).to.deep.equal({});
		});

		it('should not error logging out if not logged in', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				logout(post) {
					counter++;
					expect(post.refresh_token).to.be.ok;
				}
			});

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			await this.auth.logout();

			expect(this.auth.authenticator.email).to.be.null;
			expect(this.auth.authenticator.expires).to.deep.equal({
				access: null,
				refresh: null
			});
			expect(this.auth.authenticator.tokens).to.deep.equal({});
			expect(counter).to.equal(0);
		});
	});

	describe('User Info', () => {
		afterEach(stopLoginServer);

		it('should error if not logged in', async function () {
			this.server = await createLoginServer();

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.userInfo();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Login required');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if logging in interactively', async function () {
			this.server = await createLoginServer();

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.userInfo(true);
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Login required');
				return;
			}

			throw new Error('Expected error');
		});

		it('should get user info', async function () {
			this.server = await createLoginServer();

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			await this.auth.getToken('foo');

			let info = await this.auth.userInfo();
			expect(info).to.deep.equal({
				name: 'tester2',
				email: 'foo@bar.com'
			});

			info = await this.auth.userInfo();
			expect(info).to.deep.equal({
				name: 'tester3',
				email: 'foo@bar.com'
			});
		});

		it('should handle bad user info response', async function () {
			this.server = await createLoginServer({
				userinfo(post, req, res) {
					res.writeHead(200, { 'Content-Type': 'text/plain' });
					res.end('{{{{{{');
					return true;
				}
			});

			this.auth = new Auth({
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			await this.auth.getToken('foo');

			try {
				await this.auth.userInfo();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/^invalid json response body at /i);
				return;
			}

			throw new Error('Expected error');
		});
	});
});
