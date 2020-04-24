/* eslint-disable max-len */

import Auth, { Authenticator, ClientSecret } from '../dist/index';

import { createLoginServer, stopLoginServer } from './common';

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

	describe('Login', () => {
		afterEach(stopLoginServer);

		it('should retrieve a URL for an interactive manual flow', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			const { cancel, url } = await auth.login({ manual: true });
			await cancel();
			expect(url).to.match(/^http:\/\/127\.0\.0\.1:1337\/auth\/realms\/test_realm\/protocol\/openid-connect\/auth\?access_type=offline&client_id=test_client&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback%2F.+&response_type=code&scope=openid$/);
		});

		it('should error if getting token without a code', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			await expect(auth.login({ code: '' }))
				.to.eventually.be.rejectedWith(TypeError, 'Expected code for interactive authentication to be a non-empty string');
		});

		it('should error if code is incorrect', async function () {
			this.server = await createLoginServer({
				handler(req, res) {
					res.writeHead(401, { 'Content-Type': 'text/plain' });
					res.end('Unauthorized');
				}
			});

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			await expect(auth.login({ code: 'foo' }))
				.to.eventually.be.rejectedWith(Error, 'Authentication failed: Response code 401 (Unauthorized)');
		});

		it('should timeout during interactive login', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			await expect(auth.login({ app: [ 'echo', 'hi' ], timeout: 100 }))
				.to.eventually.be.rejectedWith(Error, 'Authentication failed: Timed out');
		});

		it('should authenticate using code', async function () {
			let counter = 0;

			this.server = await createLoginServer({
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
				realm:          'test_realm',
				tokenStoreType: null
			});

			const account = await auth.login({ code: 'foo' });
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
			expect(account.name).to.equal('test_client:foo@bar.com');
		});

		it('should error if server is unreachable', async function () {
			this.timeout(5000);

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login({ code: 'foo' }))
				.to.eventually.be.rejectedWith(Error, /connect ECONNREFUSED 127.0.0.1:133/i);
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

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login({ code: 'foo' }))
				.to.eventually.be.rejectedWith(Error, 'Authentication failed: Invalid server response');
		});

		(isCI ? it.skip : it)('should do interactive login', async function () {
			this.timeout(5000);

			this.server = await createLoginServer();

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
			expect(account.name).to.equal('test_client:foo@bar.com');
		});

		(isCI ? it.skip : it)('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			this.server = await createLoginServer({
				expiresIn: 1,
				token(post) {
					expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
					expect(post.client_secret).to.equal('###');
				}
			});

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let results = await auth.login({ code: 'foo' });
			expect(results.auth.tokens.access_token).to.equal(this.server.accessToken);

			await new Promise(resolve => setTimeout(resolve, 1200));

			results = await auth.login({ code: 'foo' });
			expect(results.auth.tokens.access_token).to.equal(this.server.accessToken);
		});
	});

	describe('Service Login', () => {
		afterEach(stopLoginServer);

		it('should error if login options is not an object', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login('foo'))
				.to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
		});

		it('should error if server is unreachable', async function () {
			this.timeout(5000);

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login())
				.to.eventually.be.rejectedWith(Error, /connect ECONNREFUSED 127.0.0.1:133/i);
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

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login())
				.to.eventually.be.rejectedWith(Error, 'Authentication failed: Invalid server response');
		});

		it('should login in non-interactively and ignore manual flag', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login({ manual: true });
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
		});

		it('should login without a code', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
			expect(account.name).to.equal('test_client:foo@bar.com');
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
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let results = await auth.login();
			expect(results.auth.tokens.access_token).to.equal(this.server.accessToken);

			await new Promise(resolve => setTimeout(resolve, 1200));

			results = await auth.login();
			expect(results.auth.tokens.access_token).to.equal(this.server.accessToken);
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
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login({ code: 'foo' });
			expect(account.name).to.equal('test_client:foo@bar.com');

			const revoked = await auth.logout({ accounts: account.name });
			expect(revoked).to.have.lengthOf(1);
		});

		it('should not error logging out if not logged in', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				logout() {
					counter++;
				}
			});

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const revoked = await auth.logout({ accounts: [ 'test_client:foo@bar.com' ] });
			expect(revoked).to.have.lengthOf(0);
			expect(counter).to.equal(0);
		});
	});
});
