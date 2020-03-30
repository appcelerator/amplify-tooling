/* eslint-disable no-unused-expressions */

import Auth, { Authenticator, MemoryStore, OwnerPassword } from '../dist/index';
import tmp from 'tmp';

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

	describe('Login', () => {
		afterEach(stopLoginServer);

		it('should error if login options is not an object', async () => {
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login('foo');
			} catch (err) {
				expect(err).to.be.instanceof(TypeError);
				expect(err.message).to.equal('Expected options to be an object');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server is unreachable', async function () {
			this.timeout(5000);

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({
					username: 'foo',
					password: 'bar'
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/connect ECONNREFUSED 127.0.0.1:133/i);
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

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({
					username: 'foo',
					password: 'bar'
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: 401 Unauthorized');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate and return the access token', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			let results = await auth.login({
				username: 'foo',
				password: 'bar'
			});
			const { accessToken } = this.server;
			expect(results.accessToken).to.equal(accessToken);
			expect(results.account.name).to.equal('test_client:foo@bar.com');
			expect(results.account.expired).to.be.false;
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

			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir,
				tokenStoreType: 'file'
			});

			let results = await auth.login({
				username: 'foo',
				password: 'bar'
			});
			const { accessToken } = this.server;
			expect(results.accessToken).to.equal(accessToken);
			expect(results.account.expired).to.be.false;

			await new Promise(resolve => setTimeout(resolve, 1500));

			expect(results.account.expired).to.be.true;

			results = await auth.login({
				username: 'foo',
				password: 'bar'
			});
			expect(results.accessToken).to.not.equal(accessToken);
			expect(results.accessToken).to.equal(this.server.accessToken);
			expect(results.account.expired).to.be.false;
		});

		it('should handle bad user info response', async function () {
			this.server = await createLoginServer({
				userinfo(post, req, res) {
					res.writeHead(200, { 'Content-Type': 'text/plain' });
					res.end('{{{{{{');
					return true;
				}
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login({
					username: 'foo',
					password: 'bar'
				});
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/^Fetch user info failed: Invalid JSON response at /i);
				return;
			}

			throw new Error('Expected error');
		});
	});

	describe('Get Account', () => {
		afterEach(stopLoginServer);

		it('should return null if not logged in', async function () {
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			const account = await auth.getAccount({ accountName: 'test_client:foo@bar.com' });
			expect(account).to.be.null;
		});

		it('should get account info once logged in', async function () {
			this.server = await createLoginServer();

			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir,
				tokenStoreType: 'file'
			});

			let results = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			const account = await auth.getAccount({ accountName: 'test_client:foo@bar.com' });
			expect(account).to.be.ok;
			expect(account.name).to.equal(`test_client:${results.account.user.email}`);
			expect(account.expired).to.be.false;
		});
	});

	describe('Revoke', () => {
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
				}
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const { account } = await auth.login({
				username: 'foo',
				password: 'bar'
			});
			expect(account.name).to.equal('test_client:foo@bar.com');
			expect(account.expired).to.be.false;

			const revoked = await auth.revoke({ accounts: account.name });
			expect(revoked).to.have.lengthOf(1);
			expect(revoked[0].expired).to.be.true;
		});

		it('should log out of all accounts', async function () {
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
				}
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				platformUrl:    'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const { account } = await auth.login({
				username: 'foo',
				password: 'bar'
			});
			expect(account.name).to.equal('test_client:foo@bar.com');
			expect(account.expired).to.be.false;

			const revoked = await auth.revoke({ all: true });
			expect(revoked).to.have.lengthOf(1);
			expect(revoked[0].expired).to.be.true;
		});

		it('should not error logging out if not logged in', async function () {
			let deleteCounter = 0;
			let requestCounter = 0;

			this.server = await createLoginServer({
				logout() {
					requestCounter++;
				}
			});

			class Foo extends MemoryStore {
				async clear(...args) {
					deleteCounter++;
					return await super.clear(...args);
				}

				async delete(...args) {
					deleteCounter++;
					return await super.delete(...args);
				}
			}

			const auth = new Auth({
				baseUrl:     'http://127.0.0.1:1337',
				platformUrl: 'http://127.0.0.1:1337',
				clientId:    'test_client',
				realm:       'test_realm',
				tokenStore:  new Foo()
			});

			const revoked = await auth.revoke({ accounts: [ 'test_client:foo@bar.com' ] });
			expect(revoked).to.have.lengthOf(0);
			expect(deleteCounter).to.equal(1);
			expect(requestCounter).to.equal(0);
		});

		it('should not error logging out with empty list of accounts', async function () {
			let deleteCounter = 0;
			let requestCounter = 0;

			this.server = await createLoginServer({
				logout() {
					requestCounter++;
				}
			});

			class Foo extends MemoryStore {
				async clear(...args) {
					deleteCounter++;
					return await super.clear(...args);
				}

				async delete(...args) {
					deleteCounter++;
					return await super.delete(...args);
				}
			}

			const auth = new Auth({
				baseUrl:     'http://127.0.0.1:1337',
				platformUrl: 'http://127.0.0.1:1337',
				clientId:    'test_client',
				realm:       'test_realm',
				tokenStore:  new Foo()
			});

			const revoked = await auth.revoke({ accounts: [] });
			expect(revoked).to.have.lengthOf(0);
			expect(deleteCounter).to.equal(0);
			expect(requestCounter).to.equal(0);
		});
	});
});
