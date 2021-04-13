import { Auth } from '../dist/index';
import { createLoginServer, stopLoginServer } from './common';
import serverInfo from './server-info.json';
import tmp from 'tmp';

tmp.setGracefulCleanup();

const homeDir = tmp.tmpNameSync({ prefix: 'test-amplify-sdk-' });

describe('Auth', () => {
	describe('Constructor', () => {
		afterEach(stopLoginServer);

		it('should error if options is not an object', () => {
			expect(() => {
				new Auth('foo');
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if token refresh threshold is invalid', function () {
			this.timeout(120000);
			this.slow(10000);

			expect(() => {
				new Auth({
					homeDir,
					tokenRefreshThreshold: 'foo',
					tokenStoreType: 'memory'
				});
			}).to.throw(TypeError, 'Expected token refresh threshold to be a number of seconds');

			expect(() => {
				new Auth({
					homeDir,
					tokenRefreshThreshold: -123,
					tokenStoreType: 'memory'
				});
			}).to.throw(RangeError, 'Token refresh threshold must be greater than or equal to zero');
		});

		it('should set the token refresh threshold', () => {
			const auth = new Auth({
				tokenStoreType: 'auto',
				tokenRefreshThreshold: 10
			});

			expect(auth.tokenStore.tokenRefreshThreshold).to.equal(10000);
		});

		it('should error if token store is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl:        'http://127.0.0.1:1337',
					clientId:       'test_client',
					realm:          'test_realm',
					tokenStore:     'foo',
					tokenStoreType: null
				});
			}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');
		});
	});

	describe('Environment', () => {
		it('should error if env is invalid', async () => {
			const auth = new Auth({
				tokenStoreType: null
			});
			await expect(auth.login({ env: 'foo' })).to.eventually.be.rejectedWith(Error, 'Invalid environment "foo"');
		});
	});

	describe('Server Info', () => {
		afterEach(stopLoginServer);

		it('should fetch server info', async function () {
			this.server = await createLoginServer();

			const auth = new Auth({
				tokenStoreType: null
			});
			const info = await auth.serverInfo({ url: 'http://127.0.0.1:1337/auth/realms/test_realm/.well-known/openid-configuration' });
			expect(info).to.deep.equal(serverInfo);
		});

		it('should throw error if server returns error', async function () {
			this.server = await createLoginServer({
				serverinfo(post, req, res) {
					res.writeHead(500);
					res.end('Server error');
					return true;
				}
			});

			const auth = new Auth({
				tokenStoreType: null
			});
			await expect(auth.serverInfo({ url: 'http://127.0.0.1:1337/auth/realms/test_realm/.well-known/openid-configuration' }))
				.to.eventually.be.rejectedWith(Error, 'Failed to get server info (status 500)');
		});

		it('should throw error if server response is invalid', async function () {
			this.server = await createLoginServer({
				serverinfo(post, req, res) {
					res.writeHead(200);
					res.end('{{{{{{{{{{');
					return true;
				}
			});

			const auth = new Auth({
				tokenStoreType: null
			});
			await expect(auth.serverInfo({ url: 'http://127.0.0.1:1337/auth/realms/test_realm/.well-known/openid-configuration' }))
				.to.eventually.be.rejectedWith(Error, /^Unexpected token {/);
		});

		it('should throw error applying defaults if env is invalid', async () => {
			const auth = new Auth({
				tokenStoreType: null
			});
			await expect(auth.serverInfo({ env: 'foo' })).to.eventually.be.rejectedWith(Error, 'Invalid environment "foo"');
		});
	});

	describe('Logout', () => {
		it('should return empty array if no token store', async () => {
			const auth = new Auth({
				tokenStoreType: null
			});
			const revoked = await auth.logout();
			expect(revoked).to.have.lengthOf(0);
		});

		it('should should error if accounts is not all or an array', async () => {
			const auth = new Auth({
				tokenStoreType: 'memory'
			});

			try {
				await auth.logout();
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal('Expected accounts to be a list of accounts');
				return;
			}

			throw new Error('Expected invalid arguments error');
		});
	});
});
