import fs from 'fs';
import tmp from 'tmp';
import { Auth, MemoryStore, TokenStore } from '../../../dist/lib/amplify-sdk/index.js';

// Mock keytar for testing secure token store as it has issues running in the test environment.
const mockKeytar = {
	key: {},
	getPassword: async (service, _account) => {
		return mockKeytar.key[service];
	},
	setPassword: async (service, _account, password) => {
		mockKeytar.key[service] = password;
	},
	deletePassword: async (service, _account) => {
		delete mockKeytar.key[service];
	}
};

const isCI = process.env.CI || process.env.JENKINS;

tmp.setGracefulCleanup();

const homeDir = tmp.tmpNameSync({ prefix: 'test-amplify-sdk-' });

describe('Token Store', () => {
	describe('Constructor', () => {
		it('should error if options is not an object', () => {
			expect(() => {
				new TokenStore('foo');
			}).to.throw(TypeError, 'Expected options to be an object');
		});
	});

	describe('Null Token Store', () => {
		it('should return null when getting an account', async () => {
			const auth = new Auth({
				tokenStoreType: null
			});
			expect(await auth.find()).to.be.null;
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
		afterEach(() => {
			process.env.TOKEN_EXPIRY = undefined;
		});

		it('should persist the token to a file', async function () {
			const baseUrl = 'http://127.0.0.1:8555';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				realm: 'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].auth.authenticator).to.equal('ClientSecret');
			expect(tokens[0].auth.baseUrl).to.equal('http://127.0.0.1:8555');
			expect(tokens[0].auth.expires.access).to.be.ok;
			expect(tokens[0].auth.tokens.access_token).to.equal(account.auth.tokens.access_token);
			expect(tokens[0].name).to.equal('test-auth-client-secret');

			await auth.logout({ accounts: account.name, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should clear all tokens', async function () {
			const baseUrl = 'http://127.0.0.1:8555';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				realm: 'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].auth.authenticator).to.equal('ClientSecret');
			expect(tokens[0].auth.baseUrl).to.equal('http://127.0.0.1:8555');
			expect(tokens[0].auth.expires.access).to.be.ok;
			expect(tokens[0].auth.tokens.access_token).to.equal(account.auth.tokens.access_token);
			expect(tokens[0].name).to.equal('test-auth-client-secret');

			await auth.logout({ all: true });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should clear all tokens for a specific base url', async function () {
			const baseUrl = 'http://127.0.0.1:8555';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				realm: 'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].auth.authenticator).to.equal('ClientSecret');
			expect(tokens[0].auth.baseUrl).to.equal('http://127.0.0.1:8555');
			expect(tokens[0].auth.expires.access).to.be.ok;
			expect(tokens[0].auth.tokens.access_token).to.equal(account.auth.tokens.access_token);
			expect(tokens[0].name).to.equal('test-auth-client-secret');

			await auth.logout({ all: true, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should not list expired tokens', async function () {
			process.env.TOKEN_EXPIRY = '1';

			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:8555',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenStoreType: 'memory'
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
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
		afterEach(() => {
			process.env.TOKEN_EXPIRY = undefined;
		});

		it('should error if token store file path is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: 'http://127.0.0.1:8555',
					clientId: 'test_client',
					realm: 'test_realm',
					tokenStoreType: 'file'
				});
			}).to.throw(TypeError, 'Token store requires a home directory');
		});

		it('should persist the token to a file', async function () {
			const baseUrl = 'http://127.0.0.1:8555';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				homeDir,
				realm: 'test_realm',
				tokenStoreType: 'file'
			});
			const { tokenStoreFile } = auth.tokenStore;

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			expect(fs.existsSync(tokenStoreFile)).to.be.true;

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].auth.authenticator).to.equal('ClientSecret');
			expect(tokens[0].auth.baseUrl).to.equal('http://127.0.0.1:8555');
			expect(tokens[0].auth.expires.access).to.be.ok;
			expect(tokens[0].auth.tokens.access_token).to.equal(account.auth.tokens.access_token);
			expect(tokens[0].name).to.equal('test-auth-client-secret');

			await auth.logout({ accounts: account.name, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should clear all tokens and delete token file', async function () {
			const baseUrl = 'http://127.0.0.1:8555';
			const tokenStoreDir = this.tempFile = tmp.tmpNameSync({ prefix: 'test-amplify-sdk-' });
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				homeDir,
				realm: 'test_realm',
				tokenStoreDir,
				tokenStoreType: 'file'
			});
			const { tokenStoreFile } = auth.tokenStore;

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			expect(fs.existsSync(tokenStoreFile)).to.be.true;

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].auth.authenticator).to.equal('ClientSecret');
			expect(tokens[0].auth.baseUrl).to.equal('http://127.0.0.1:8555');
			expect(tokens[0].auth.expires.access).to.be.ok;
			expect(tokens[0].auth.tokens.access_token).to.equal(account.auth.tokens.access_token);
			expect(tokens[0].name).to.equal('test-auth-client-secret');

			await auth.logout({ all: true });

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should not list expired tokens', async function () {
			process.env.TOKEN_EXPIRY = '1';

			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:8555',
				clientId: 'test_client',
				homeDir,
				realm: 'test_realm',
				tokenStoreType: 'file'
			});
			const { tokenStoreFile } = auth.tokenStore;

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			expect(fs.existsSync(tokenStoreFile)).to.be.false;

			await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
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

		it('should error if home directory is invalid', () => {
			try {
				new Auth({
					baseUrl: 'http://127.0.0.1:8555',
					clientId: 'test_client',
					secureServiceName,
					realm: 'test_realm',
					tokenStoreDir: tmp.tmpNameSync({ prefix: 'test-amplify-sdk-' }),
					tokenStoreType: 'secure',
					keytar: mockKeytar
				});
			} catch (e) {
				expect(e).to.be.instanceof(TypeError);
				expect(e.message).to.equal('Secure store requires the home directory to be specified');
				return;
			}

			throw new Error('Expected error');
		});

		it('should securely store the token', async function () {
			if (isCI) {
				return this.skip();
			}
			this.timeout(60000);
			this.slow(10000);

			const baseUrl = 'http://127.0.0.1:8555';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				homeDir,
				secureServiceName,
				realm: 'test_realm',
				tokenStoreType: 'secure',
				keytar: mockKeytar
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].auth.authenticator).to.equal('ClientSecret');
			expect(tokens[0].auth.baseUrl).to.equal('http://127.0.0.1:8555');
			expect(tokens[0].auth.expires.access).to.be.ok;
			expect(tokens[0].auth.tokens.access_token).to.equal(account.auth.tokens.access_token);
			expect(tokens[0].name).to.equal('test-auth-client-secret');

			await auth.logout({ accounts: account.name, baseUrl });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});

		it('should clear all tokens and delete secure store', async function () {
			if (isCI) {
				return this.skip();
			}
			this.timeout(60000);
			this.slow(10000);

			const baseUrl = 'http://127.0.0.1:8555';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				homeDir,
				secureServiceName,
				realm: 'test_realm',
				tokenStoreType: 'secure',
				keytar: mockKeytar
			});

			let tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(1);
			expect(tokens[0].auth.authenticator).to.equal('ClientSecret');
			expect(tokens[0].auth.baseUrl).to.equal('http://127.0.0.1:8555');
			expect(tokens[0].auth.expires.access).to.be.ok;
			expect(tokens[0].auth.tokens.access_token).to.equal(account.auth.tokens.access_token);
			expect(tokens[0].name).to.equal('test-auth-client-secret');

			await auth.logout({ all: true });

			tokens = await auth.list();
			expect(tokens).to.have.lengthOf(0);
		});
	});

	describe('Custom Token Store', () => {

		it('should error if custom token store does not extend TokenStore', () => {
			expect(() => {
				new Auth({
					baseUrl: 'http://127.0.0.1:8555',
					clientId: 'test_client',
					realm: 'test_realm',
					tokenStore: '123'
				});
			}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');
		});

		it('should use a custom token store', async function () {
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

			const baseUrl = 'http://127.0.0.1:8555';
			const auth = new Auth({
				baseUrl,
				clientId: 'test_client',
				realm: 'test_realm',
				tokenStore: new Foo(),
			});

			expect(setCounter).to.equal(0);
			expect(delCounter).to.equal(0);

			const account = await auth.login({
				clientId: 'test-auth-client-secret',
				clientSecret: 'shhhh'
			});

			expect(setCounter).to.equal(1);
			expect(delCounter).to.equal(0);

			await auth.logout({ accounts: account.name, baseUrl });

			expect(setCounter).to.equal(1);
			expect(delCounter).to.equal(1);
		});
	});
});
