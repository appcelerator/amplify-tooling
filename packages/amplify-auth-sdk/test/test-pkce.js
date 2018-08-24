/* eslint-disable max-len */

import Auth, { Authenticator } from '../dist/index';
import fetch from 'node-fetch';
import snooplogg from 'snooplogg';

import { createLoginServer, stopLoginServer } from './common';

const { log } = snooplogg('test:amplify-auth:pkce');

const isCI = process.env.CI || process.env.JENKINS;

describe('PKCE', () => {
	describe('Login', () => {
		afterEach(stopLoginServer);

		it('should error options is not an object', async function () {
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login('foo');
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Expected options to be an object');
				return;
			}

			throw new Error('Expected error');
		});

		it('should retrieve a URL for an interactive manual flow', async function () {
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			const { cancel, url } = await auth.login({ manual: true });
			await cancel();
			expect(url).to.match(/^http:\/\/127\.0\.0\.1:1337\/auth\/realms\/test_realm\/protocol\/openid-connect\/auth\?access_type=offline&client_id=test_client&code_challenge=.+&code_challenge_method=S256&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback%2F.+&response_type=code&scope=openid$/);
		});

		it('should error if getting token without a code', async function () {
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({ code: '' });
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

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({ code: 'foo' });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: Unauthorized');
				return;
			}

			throw new Error('Expected error');
		});

		it('should timeout during interactive login', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({ app: [ 'echo', 'hi' ], timeout: 100 });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: Timed out');
				expect(e.code).to.equal('ERR_AUTH_TIMEOUT');
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
				}
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			const { accessToken } = await auth.login({ code: 'foo' });
			expect(accessToken).to.equal(this.server.accessToken);
		});

		it('should error if server is unreachable', async function () {
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({ code: 'foo' });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/connect ECONNREFUSED 127.0.0.1:133/i);
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

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({ code: 'foo' });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: Invalid server response');
				return;
			}

			throw new Error('Expected error');
		});

		(isCI ? it.skip : it)('should do interactive login', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			const { accessToken, account } = await auth.login();
			expect(accessToken).to.equal(this.server.accessToken);
			expect(account.name).to.equal('foo@bar.com');
		});

		(isCI ? it.skip : it)('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			this.server = await createLoginServer({
				expiresIn: 1,
				token(post) {
					expect(post.grant_type).to.equal(Authenticator.GrantTypes.AuthorizationCode);
				}
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let results = await auth.login({ code: 'foo' });
			expect(results.accessToken).to.equal(this.server.accessToken);

			await new Promise(resolve => setTimeout(resolve, 1200));

			results = await auth.login({ code: 'foo' });
			expect(results.accessToken).to.equal(this.server.accessToken);
		});

		it('should fail to get user info', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await auth.login({ code: 'foo' });

			await stopLoginServer.call(this);

			try {
				await auth.login({ code: 'foo' });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/connect ECONNREFUSED 127.0.0.1:133/i);
				expect(e.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected error');
		});
	});

	describe('Revoke', () => {
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
				}
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const { account } = await auth.login({ code: 'foo' });
			const revoked = await auth.revoke({ accounts: account.name });
			expect(revoked).to.have.lengthOf(1);
		});

		it('should not error logging out if not logged in', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				logout(post) {
					counter++;
				}
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const revoked = await auth.revoke({ accounts: 'foo@bar.com' });
			expect(revoked).to.have.lengthOf(0);
			expect(counter).to.equal(0);
		});
	});

	describe('Messages', () => {
		afterEach(stopLoginServer);

		it('should override a default message with a text string', async function () {
			this.server = await createLoginServer();

			const text = 'It worked!';

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null,
				messages: {
					interactiveSuccess: text
				}
			});

			let { promise, url } = await auth.login({ manual: true });

			promise.catch(() => {});

			log(`Manually fetching ${url}`);
			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			url = res.headers.get('location');
			log(`Fetching ${url}`);

			res = await fetch(url, {
				headers: {
					Accept: 'text/plain'
				}
			});

			expect(res.status).to.equal(200);
			expect(await res.text()).to.equal(text);
		});

		it('should override a default message with a object and html', async function () {
			this.server = await createLoginServer();

			const html = '<html><body>It worked!!</body></html>';

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			const { promise, url } = await auth.login({
				manual: true,
				messages: {
					interactiveSuccess: {
						html,
						text: 'It worked!!'
					}
				}
			});

			promise.catch(() => {});

			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			res = await fetch(res.headers.get('location'));
			expect(res.status).to.equal(200);
			expect(await res.text()).to.equal(html);
		});

		it('should respond to interactive login as json', async function () {
			this.server = await createLoginServer();

			const text = 'It worked!';

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null,
				messages: {
					interactiveSuccess: text
				}
			});

			let { promise, url } = await auth.login({ manual: true });

			promise.catch(() => {});

			log(`Manually fetching ${url}`);
			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			url = res.headers.get('location');
			log(`Fetching ${url}`);

			res = await fetch(url, {
				headers: {
					Accept: 'application/json'
				}
			});

			expect(res.status).to.equal(200);
			expect(await res.json()).to.deep.equal({
				message: 'It worked!',
				success: true
			});
		});

		it('should respond to failed interactive login as json', async function () {
			this.server = await createLoginServer();

			const text = 'It worked!';

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null,
				messages: {
					interactiveSuccess: text
				}
			});

			let { promise, url } = await auth.login({ manual: true });

			promise.catch(() => {});

			log(`Manually fetching ${url}`);
			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			url = res.headers.get('location').split('?')[0];
			log(`Fetching ${url}`);

			res = await fetch(url, {
				headers: {
					Accept: 'application/json'
				}
			});

			expect(res.status).to.equal(400);
			expect(await res.json()).to.deep.equal({
				message: 'Invalid auth code',
				success: false
			});
		});
	});
});
