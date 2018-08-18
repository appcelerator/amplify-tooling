import Auth, { MemoryStore, TokenStore } from '../dist/index';
import fs from 'fs-extra';
import tmp from 'tmp';

import { createLoginServer, stopLoginServer } from './common';

const isCI = process.env.CI || process.env.JENKINS;

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

	describe('Null Token Store', () => {
		it('should return null when getting an account', async () => {
			const auth = new Auth({
				tokenStoreType: null
			});
			expect(await auth.getAccount()).to.be.null;
		});

		it('should return empty array when listing accounts', async () => {
			const auth = new Auth({
				tokenStoreType: null
			});
			const accounts = await auth.list();
			expect(accounts).to.be.an('Array');
			expect(accounts).to.have.lengthOf(0);
		});
	});

	describe('Memory Store', () => {
		afterEach(stopLoginServer);

		it('should persist the token to a file', async function () {
			this.server = await createLoginServer();

			const baseUrl = 'http://127.0.0.1:1337';
			const auth = new Auth({
				baseUrl,
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const { accessToken, account } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].name).to.equal('foo@bar.com');
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.revoke({ accounts: account.name, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should clear all tokens', async function () {
			this.server = await createLoginServer();

			const baseUrl = 'http://127.0.0.1:1337';
			const auth = new Auth({
				baseUrl,
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const { accessToken } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].name).to.equal('foo@bar.com');
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.revoke({ all: true });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should clear all tokens for a specific base url', async function () {
			this.server = await createLoginServer();

			const baseUrl = 'http://127.0.0.1:1337';
			const auth = new Auth({
				baseUrl,
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const { accessToken } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].name).to.equal('foo@bar.com');
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.revoke({ all: true, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should not list expired tokens', async function () {
			this.server = await createLoginServer({
				expiresIn: 1,
				refreshExpiresIn: 1
			});

			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			await auth.login({
				username: 'foo',
				password: 'bar'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);

			await new Promise(resolve => setTimeout(resolve, 1500));

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should error trying to get a account without a name or hash', async () => {
			const store = new MemoryStore();
			try {
				await store.get();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Must specify either the account name or authenticator hash');
				return;
			}
			throw new Error('Expected error');
		});

		it('should return null if account is not found', async () => {
			const store = new MemoryStore();
			const account = await store.get({ accountName: 'foo' });
			expect(account).to.be.null;
		});
	});

	describe('File Token Store', () => {
		afterEach(stopLoginServer);

		it('should error if token store file path is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl:        'http://127.0.0.1:1337',
					clientId:       'test_client',
					realm:          'test_realm',
					tokenStoreType: 'file'
				});
			}).to.throw(TypeError, 'Token store requires a token store path');
		});

		it('should persist the token to a file', async function () {
			this.server = await createLoginServer();

			const baseUrl = 'http://127.0.0.1:1337';
			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });
			const auth = new Auth({
				baseUrl,
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir,
				tokenStoreType: 'file'
			});
			const { tokenStoreFile } = auth.tokenStore;

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			const { accessToken, account } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			expect(fs.existsSync(tokenStoreFile)).to.be.true;

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].name).to.equal('foo@bar.com');
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.revoke({ accounts: account.name, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should clear all tokens and delete token file', async function () {
			this.server = await createLoginServer();

			const baseUrl = 'http://127.0.0.1:1337';
			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });
			const auth = new Auth({
				baseUrl,
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir,
				tokenStoreType: 'file'
			});
			const { tokenStoreFile } = auth.tokenStore;

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			const { accessToken } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			expect(fs.existsSync(tokenStoreFile)).to.be.true;

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].name).to.equal('foo@bar.com');
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.revoke({ all: true });

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should not list expired tokens', async function () {
			this.server = await createLoginServer({
				expiresIn: 1,
				refreshExpiresIn: 1
			});

			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreDir,
				tokenStoreType: 'file'
			});
			const { tokenStoreFile } = auth.tokenStore;

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			await auth.login({
				username: 'foo',
				password: 'bar'
			});

			expect(fs.existsSync(tokenStoreFile)).to.be.true;

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);

			await new Promise(resolve => setTimeout(resolve, 1500));

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});
	});

	describe('Secure Token Store', () => {
		const secureServiceName = 'Axway AMPLIFY Auth Test';

		afterEach(stopLoginServer);

		afterEach(async () => {
			if (!isCI || process.platform !== 'linux') {
				await require('keytar').deletePassword(secureServiceName, secureServiceName);
			}
		});

		(isCI && process.platform === 'linux' ? it.skip : it)('should securely store the token', async function () {
			this.server = await createLoginServer();

			const baseUrl = 'http://127.0.0.1:1337';
			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });
			const auth = new Auth({
				baseUrl,
				clientId:       'test_client',
				secureServiceName,
				realm:          'test_realm',
				tokenStoreDir,
				tokenStoreType: 'secure'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const { accessToken, account } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].name).to.equal('foo@bar.com');
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.revoke({ accounts: account.name, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		(isCI && process.platform === 'linux' ? it.skip : it)('should clear all tokens and delete secure store', async function () {
			this.server = await createLoginServer();

			const baseUrl = 'http://127.0.0.1:1337';
			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-auth-sdk-' });
			const auth = new Auth({
				baseUrl,
				clientId:       'test_client',
				secureServiceName,
				realm:          'test_realm',
				tokenStoreDir,
				tokenStoreType: 'secure'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const { accessToken } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].authenticator).to.equal('OwnerPassword');
			expect(tokens[0].baseUrl).to.equal('http://127.0.0.1:1337');
			expect(tokens[0].expires.access).to.be.ok;
			expect(tokens[0].expires.refresh).to.be.ok;
			expect(tokens[0].name).to.equal('foo@bar.com');
			expect(tokens[0].tokens.access_token).to.equal(accessToken);

			await auth.revoke({ all: true });

			tokens = await auth.list();
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

			const baseUrl = 'http://127.0.0.1:1337';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				realm:    'test_realm',
				tokenStore: new Foo(),
			});

			expect(setCounter).to.equal(0);
			expect(delCounter).to.equal(0);

			const { account } = await auth.login({
				username: 'foo',
				password: 'bar'
			});

			expect(setCounter).to.equal(1);
			expect(delCounter).to.equal(0);

			await auth.revoke({ accounts: account.name, baseUrl });

			expect(setCounter).to.equal(1);
			expect(delCounter).to.equal(1);
		});
	});
});
