import AmplifySDK from '../dist/index';
import { createServer, stopServer } from './common';

const baseUrl = 'http://127.0.0.1:1337';
const isCI = process.env.CI || process.env.JENKINS;

function createSDK(opts = {}) {
	return new AmplifySDK({
		baseUrl,
		clientId: 'test_client',
		platformUrl: baseUrl,
		realm: 'test_realm',
		tokenStoreType: 'memory',
		...opts
	});
}

describe.only('amplify-sdk', () => {
	describe('Service Account', () => {
		describe('find()', () => {
			afterEach(stopServer);

			it.skip('should find an existing platform account', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const acct = await sdk.serviceAccount.find('test_client:foo@bar.com');
				expect(acct.auth).to.deep.equal({
					baseUrl,
					expires: account.auth.expires,
					tokens: {
						access_token: 'platform_access_token',
						refresh_token: 'platform_refresh_token'
					}
				});

				const accounts = await sdk.auth.list();
				expect(accounts).to.have.lengthOf(1);
			});
		});

		describe('list()', () => {
			afterEach(stopServer);

			it('should list no service accounts', async function () {
				this.timeout(10000);
			});
		});

		describe('create()', () => {
			afterEach(stopServer);
		});

		describe('update()', () => {
			afterEach(stopServer);
		});

		describe('remove()', () => {
			afterEach(stopServer);
		});
	});
});
