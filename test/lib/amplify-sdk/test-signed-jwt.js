import path from 'path';
import nock from 'nock';
import { Auth, SignedJWT } from '../../../dist/lib/amplify-sdk/index.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Signed JWT', () => {
	describe('Constructor', () => {
		it('should error if options is invalid', () => {
			expect(() => {
				new SignedJWT();
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if secret is invalid', () => {
			expect(() => {
				new SignedJWT({});
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secret: null });
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secret: '' });
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secret: 123 });
			}).to.throw(TypeError, 'Expected private key to be a string');

			expect(() => {
				new SignedJWT({ secretFile: null });
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secretFile: '' });
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secretFile: 123 });
			}).to.throw(Error, 'Expected private key file path to be a string');

			expect(() => {
				new SignedJWT({ secretFile: __dirname });
			}).to.throw(Error, /^Specified private key is not a file:/);
		});
	});

	describe('Login', () => {

		it('should error if private key file does not exist', async function () {
			const secretFile = path.join(__dirname, 'does_not_exist');

			const auth = new Auth({
				secretFile,
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login();
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal(`Specified private key file does not exist: ${secretFile}`);
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if login options is not an object', async function () {
			const auth = new Auth({
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
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
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:855',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/connect ECONNREFUSED 127.0.0.1:855/i);
				expect(e.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if JWT token is incorrect', async function () {
			nock('http://127.0.0.1:8555')
				.post('/auth/realms/test_realm/protocol/openid-connect/token')
				.once()
				.reply(401, 'Unauthorized');

			const auth = new Auth({
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: Request failed with status code 401 (Unauthorized): POST http://127.0.0.1:8555/auth/realms/test_realm/protocol/openid-connect/token');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server returns an invalid user identity', async function () {
			nock('http://127.0.0.1:8555')
				.post('/auth/realms/test_realm/protocol/openid-connect/token')
				.once()
				.reply(200, {
					access_token: 'foo',
					refresh_token: 'bar',
					expires_in: 600,
					refresh_expires_in: 600
				});

			const auth = new Auth({
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: Invalid server response');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate and return the access token', async function () {
			const auth = new Auth({
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			expect(account.name).to.equal('test-auth-client-cert');
		});

		it('should authenticate when user info returns error', async function () {
			nock('http://127.0.0.1:8555', { allowUnmocked: true })
				.post('/auth/realms/test_realm/protocol/openid-connect/userinfo')
				.once()
				.reply(500, 'Server error');

			const auth = new Auth({
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			expect(account.name).to.equal('test-auth-client-cert');
		});
	});

	describe('Logout', () => {

		it('should log out', async function () {
			const auth = new Auth({
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			const revoked = await auth.logout({ accounts: account.name });
			expect(revoked).to.have.lengthOf(1);
		});

		it('should not error logging out if not logged in', async function () {
			const auth = new Auth({
				secretFile:     path.join(__dirname, '../../helpers/private_key.pem'),
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-cert',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const revoked = await auth.logout({ accounts: 'test-auth-client-cert' });
			expect(revoked).to.have.lengthOf(0);
		});
	});
});
