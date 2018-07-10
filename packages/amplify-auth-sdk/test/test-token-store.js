import Auth, { TokenStore } from '../dist/index';
import fs from 'fs-extra';
import tmp from 'tmp';

import { createLoginServer, stopLoginServer } from './common';

tmp.setGracefulCleanup();

describe('Token Store', () => {
	describe('Constructor', () => {
		it('should error if options is not an object', () => {
			expect(() => {
				new TokenStore('foo');
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if token refresh threshold is invalid', () => {
			expect(() => {
				new TokenStore({
					tokenRefreshThreshold: 'foo'
				});
			}).to.throw(TypeError, 'Expected token refresh threshold to be a number of seconds');

			expect(() => {
				new TokenStore({
					tokenRefreshThreshold: -123
				});
			}).to.throw(RangeError, 'Token refresh threshold must be greater than or equal to zero');
		});
	});

	describe('File Token Store', () => {
		afterEach(stopLoginServer);

		it('should error if token store directory is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl:        'http://127.0.0.1:1337',
					clientId:       'test_client',
					realm:          'test_realm',
					tokenStoreType: 'default'
				});
			}).to.throw(TypeError, 'File token store requires a token store directory');
		});

		it('should persist the token to a file', async function () {
			this.server = await createLoginServer();

			const dir = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });

			const auth = new Auth({
				username:       'foo',
				password:       'bar',
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir:  dir,
				tokenStoreType: 'default'
			});

			let tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(dir)).to.be.false;

			const { accessToken } = await auth.login();

			expect(fs.existsSync(dir)).to.be.true;

			tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].email).to.equal('foo@bar.com');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.logout();

			tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should not list expired tokens', async function () {
			this.server = await createLoginServer({
				expiresIn: 1,
				refreshExpiresIn: 1
			});

			const dir = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });

			const auth = new Auth({
				username:       'foo',
				password:       'bar',
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir:  dir,
				tokenStoreType: 'default'
			});

			let tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(dir)).to.be.false;

			await auth.login();

			expect(fs.existsSync(dir)).to.be.true;

			tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(1);

			await new Promise(resolve => setTimeout(resolve, 1500));

			tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should skip login if valid token exists', async function () {
			this.server = await createLoginServer();

			const dir = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });

			const auth1 = new Auth({
				username:       'foo',
				password:       'bar',
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir:  dir,
				tokenStoreType: 'default'
			});

			let tokens = await auth1.listTokens();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(dir)).to.be.false;

			const results1 = await auth1.login();

			expect(fs.existsSync(dir)).to.be.true;

			tokens = await auth1.listTokens();
			expect(tokens).to.have.lengthOf(1);

			await stopLoginServer.call(this);

			const auth2 = new Auth({
				username:       'foo',
				password:       'bar',
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir:  dir,
				tokenStoreType: 'default'
			});

			const results2 = await auth2.login();
			expect(results2.accessToken).to.equal(results1.accessToken);

			tokens = await auth2.listTokens();
			expect(tokens).to.have.lengthOf(1);
		});
	});

	describe('Keytar Token Store', () => {
		afterEach(stopLoginServer);

		it('should securely store the token', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				username:       'foo',
				password:       'bar',
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'keytar'
			});

			let tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(0);

			const { accessToken } = await auth.login();

			tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].email).to.equal('foo@bar.com');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.logout();

			tokens = await auth.listTokens();
			expect(tokens).to.have.lengthOf(0);
		});
	});

	describe('Custom Token Store', () => {
		afterEach(stopLoginServer);

		it('should error if custom token store does not extend TokenStore', () => {
			expect(() => {
				new Auth({
					baseUrl:    'http://127.0.0.1:1337',
					clientId:   'test_client',
					realm:      'test_realm',
					tokenStore: '123'
				});
			}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');
		});

		it('should use a custom token store', async function () {
			this.server = await createLoginServer();

			let setCounter = 0;
			let delCounter = 0;

			class Foo extends TokenStore {
				delete() {
					delCounter++;
				}

				set() {
					setCounter++;
				}
			}

			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl:  'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm:    'test_realm',
				tokenStore: new Foo(),
			});

			expect(setCounter).to.equal(0);
			expect(delCounter).to.equal(0);

			const { accessToken } = await auth.login();

			expect(setCounter).to.equal(1);
			expect(delCounter).to.equal(0);

			await auth.logout();

			expect(setCounter).to.equal(1);
			expect(delCounter).to.equal(1);
		});
	});
});
