import nock from 'nock';
import { Auth, ClientSecret } from '../../../dist/lib/amplify-sdk/index.js';

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

		it('should error if login options is not an object', async function () {
			const auth = new Auth({
				clientSecret:   'shhhh',
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-secret',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login('foo'))
				.to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
		});

		it('should error if server is unreachable', async function () {
			this.timeout(5000);

			const auth = new Auth({
				clientSecret:   'shhhh',
				baseUrl:        'http://127.0.0.1:855',
				clientId:       'test-auth-client-secret',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login())
				.to.eventually.be.rejectedWith(Error, /connect ECONNREFUSED 127.0.0.1:855/i);
		});

		it('should error if server returns invalid user identity', async function () {
			nock('http://127.0.0.1:8555')
				.post('/auth/realms/test_realm/protocol/openid-connect/token')
				.once()
				.reply(200, {
					// no access token!
					refresh_token:      'bar',
					expires_in:         600,
					refresh_expires_in: 600
				});

			const auth = new Auth({
				clientSecret:   'shhhh',
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-secret',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			await expect(auth.login())
				.to.eventually.be.rejectedWith(Error, 'Authentication failed: Invalid server response');
		});

		it('should login to a service account using client credentials', async function () {
			const auth = new Auth({
				clientSecret:   'shhhh',
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-secret',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			expect(account.name).to.equal('test-auth-client-secret');
		});
	});

	describe('Logout', () => {

		it('should log out', async function () {
			const auth = new Auth({
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-secret',
				clientSecret:   'shhhh',
				realm:          'test_realm',
				serviceAccount: false,
				tokenStoreType: 'memory'
			});

			const account = await auth.login();
			expect(account.name).to.equal('test-auth-client-secret');

			const revoked = await auth.logout({ accounts: account.name });
			expect(revoked).to.have.lengthOf(1);
		});

		it('should not error logging out if not logged in', async function () {
			const auth = new Auth({
				clientSecret:   'shhhh',
				serviceAccount: false,
				baseUrl:        'http://127.0.0.1:8555',
				clientId:       'test-auth-client-secret',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const revoked = await auth.logout({ accounts: [ 'test-auth-client-secret' ] });
			expect(revoked).to.have.lengthOf(0);
		});
	});
});
