import Auth, { Authenticator, OwnerPassword } from '../dist/index';
import jws from 'jws';

import { createLoginServer, stopLoginServer } from './common';

describe('Owner Password', () => {
	describe('Constructor', () => {
		it('should error if options is invalid', () => {
			expect(() => {
				new OwnerPassword();
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if username is invalid', () => {
			expect(() => {
				new OwnerPassword({});
			}).to.throw(TypeError, 'Expected username to be a non-empty string');

			expect(() => {
				new OwnerPassword({ username: null });
			}).to.throw(TypeError, 'Expected username to be a non-empty string');

			expect(() => {
				new OwnerPassword({ username: '' });
			}).to.throw(TypeError, 'Expected username to be a non-empty string');
		});

		it('should error if password is invalid', () => {
			expect(() => {
				new OwnerPassword({ username: 'foo' });
			}).to.throw(TypeError, 'Expected password to be a string');

			expect(() => {
				new OwnerPassword({ username: 'foo', password: null });
			}).to.throw(TypeError, 'Expected password to be a string');
		});
	});

	describe('Access Token', () => {
		afterEach(stopLoginServer);

		it('should error getting an access token if not logged in', async function () {
			this.auth = new Auth({
				username: 'foo',
				password: 'bar',
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

		it('should automatically login when getting the access token', async function () {
			this.server = await createLoginServer();

			this.auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			const results = await this.auth.getAccessToken(true);
			expect(results).to.equal(this.server.accessToken);
		});
	});

	describe('Login', () => {
		afterEach(stopLoginServer);

		it('should error if login options is not an object', async function () {
			this.auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.login('foo');
			} catch (err) {
				expect(err).to.be.instanceof(TypeError);
				expect(err.message).to.equal('Expected options to be an object');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server is unreachable', async function () {
			this.auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/^request to .+ failed,/i);
				expect(e.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if username/password is incorrect', async function () {
			this.server = await createLoginServer({
				handler(req, res) {
					res.writeHead(401, { 'Content-Type': 'text/plain' });
					res.end('Unauthorized');
				}
			});

			this.auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			try {
				await this.auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Unauthorized');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server returns an invalid user identity', async function () {
			this.auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			this.server = await createLoginServer({
				handler(req, res) {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						access_token: jws.sign({
							header: { alg: 'HS256' },
							payload: '{"email":""}',
							secret: 'secret'
						}),
						refresh_token:      'bar',
						expires_in:         600,
						refresh_expires_in: 600
					}));
				}
			});

			try {
				await this.auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: invalid response from server');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate and return the access token', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			let results = await auth.login();
			const { accessToken } = this.server;
			expect(results.accessToken).to.equal(accessToken);

			// stop the web server to prove subsequent logins don't make requests
			await stopLoginServer.call(this);

			// do this after stop server above
			this.auth = auth;

			results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);

			expect(auth.authenticator.email).to.equal('foo@bar.com');
		});

		it('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			let counter = 0;

			this.server = await createLoginServer({
				expiresIn: 1,
				token(post) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.Password);
							expect(post.username).to.equal('foo');
							expect(post.password).to.equal('bar');
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							break;
					}
				}
			});

			this.auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			let results = await this.auth.login();
			const { accessToken } = this.server;
			expect(results.accessToken).to.equal(accessToken);

			await new Promise(resolve => setTimeout(resolve, 1500));

			results = await this.auth.login();
			expect(results.accessToken).to.not.equal(accessToken);
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
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.Password);
							expect(post.username).to.equal('foo');
							expect(post.password).to.equal('bar');
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
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm'
			});

			await this.auth.login();

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
				username: 'foo',
				password: 'bar',
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
				username: 'foo',
				password: 'bar',
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
				username: 'foo',
				password: 'bar',
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
				username: 'foo',
				password: 'bar',
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
				username: 'foo',
				password: 'bar',
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
