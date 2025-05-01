/* eslint-disable max-len */

import { Auth, Authenticator, ClientSecret } from '../src/index.js';
import { createLoginServer, stopLoginServer } from './common.js';

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

		it('should error attempting manual flow', async function () {
			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			await expect(auth.login({ manual: true })).to.eventually.be.rejectedWith(Error, 'Manual mode is only supported with PKCE interactive authentication');
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

		(isCI ? it.skip : it)('should do login', async function () {
			this.timeout(10000);

			this.server = await createLoginServer();

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				clientSecret:   '###',
				platformUrl:    'http://127.0.0.1:1337/success',
				realm:          'test_realm',
				serviceAccount: false,
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
			expect(account.name).to.equal('test_client:foo@bar.com');
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
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				clientSecret:   '###',
				platformUrl:    'http://127.0.0.1:1337/success',
				realm:          'test_realm',
				serviceAccount: false,
				tokenStoreType: 'memory'
			});

			let account = await auth.login();
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);

			await new Promise(resolve => setTimeout(resolve, 1200));

			account = await auth.login();
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
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

		it('should error logging in with manual mode', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				clientSecret:   '###',
				serviceAccount: true,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login({ manual: true })).to.eventually.be.rejectedWith(Error, 'Manual mode is only supported with PKCE interactive authentication');
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
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				clientSecret:   '###',
				platformUrl:    'http://127.0.0.1:1337/success',
				realm:          'test_realm',
				serviceAccount: false,
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
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
