import AmplifySDK from '../dist/index';
// import tmp from 'tmp';
import { createServer, stopServer } from './common';

// tmp.setGracefulCleanup();

// const homeDir = tmp.tmpNameSync({ prefix: 'test-amplify-sdk-' });
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
	describe('Error Handling', () => {
		it('should error if options is not an object', () => {
			expect(() => {
				new AmplifySDK('foo');
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should create an SDK instance with non-existent environment', () => {
			const orig = process.env.AXWAY_CLI;
			process.env.AXWAY_CLI = '2.0.0';
			try {
				const sdk = new AmplifySDK();
				expect(sdk).to.be.an('object');
				// eslint-disable-next-line security/detect-non-literal-regexp
				expect(sdk.userAgent).to.match(new RegExp(`^AMPLIFY SDK\\/\\d\\.\\d\\.\\d \\(${process.platform}; ${process.arch}; node:${process.versions.node}\\) Axway CLI\\/2.0.0`));
			} finally {
				process.env.AXWAY_CLI = orig;
			}
		});
	});

	describe('Auth', () => {
		afterEach(stopServer);

		it('should error creating client if token store is invalid', () => {
			expect(() => {
				const client = createSDK({ tokenStore: 'foo' }).client;
				expect(client).to.be.an('object');
			}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');
		});

		it('should find an existing platform account', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore();
			const sdk = createSDK({ tokenStore });

			const acct = await sdk.auth.find('test_client:foo@bar.com');
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

		it('should find an existing service account', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore({
				tokens: {
					access_token: 'service_access_token',
					refresh_token: 'service_refresh_token'
				}
			});
			const sdk = createSDK({ tokenStore });

			const acct = await sdk.auth.find('test_client:foo@bar.com');
			expect(acct.auth).to.deep.equal({
				baseUrl,
				expires: account.auth.expires,
				tokens: {
					access_token: 'service_access_token',
					refresh_token: 'service_refresh_token'
				}
			});
		});

		it('should not find an non-existing account', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const sdk = createSDK();

			const account = await sdk.auth.find('bar');
			expect(account).to.equal(null);
		});

		(isCI ? it.skip : it)('should authenticate using interactive login via PKCE', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const sdk = createSDK();

			let account = await sdk.auth.login();
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
			expect(account.name).to.equal('test_client:foo@bar.com');

			// try to log in again
			await expect(sdk.auth.login()).to.eventually.be.rejectedWith(Error, 'Account already authenticated');

			await expect(sdk.auth.logout({ accounts: 'foo' })).to.eventually.be.rejectedWith(TypeError, 'Expected accounts to be a list of accounts');
			await sdk.auth.logout({ accounts: [] });
			await sdk.auth.logout({ all: true });
		});

		(isCI ? it.skip : it)('should authenticate if not logged in and switching org', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const sdk = createSDK();

			const account = await sdk.auth.switchOrg();
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
			expect(account.name).to.equal('test_client:foo@bar.com');

			await sdk.auth.logout({ accounts: [ account.name ] });
		});

		(isCI ? it.skip : it)('should authenticate if expired and switching org', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore({
				expires: {
					access: Date.now() - 1e6,
					refresh: Date.now() - 1e6
				},
				tokens: {
					access_token: 'expired_token',
					refresh_token: 'expired_token'
				}
			});
			const sdk = createSDK({ tokenStore });

			const acct = await sdk.auth.switchOrg(account);
			expect(acct.auth.tokens.access_token).to.equal(this.server.accessToken);
			expect(acct.name).to.equal('test_client:foo@bar.com');
		});

		(isCI ? it.skip : it)('should switch org', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore();
			const sdk = createSDK({ tokenStore });

			const acct = await sdk.auth.switchOrg(account);
			expect(acct.name).to.equal('test_client:foo@bar.com');
		});

		(isCI ? it.skip : it)('should fail to switch org if access token is bad', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore({
				tokens: {
					access_token: 'bad_access_token',
					refresh_token: 'bad_refresh_token'
				}
			});
			const sdk = createSDK({ tokenStore });

			await expect(sdk.auth.switchOrg(account)).to.eventually.be.rejectedWith(Error, 'Failed to switch organization');
		});

		it('should get server info', async function () {
			this.server = await createServer();
			const sdk = createSDK({ tokenStoreType: null });
			expect(await sdk.auth.serverInfo()).to.be.an('object');
		});
	});

	describe('Org', () => {
		describe('list()', () => {
			afterEach(stopServer);

			it('should get all orgs', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const orgs = await sdk.org.list(account);
				expect(orgs).to.have.lengthOf(2);
				expect(orgs[0].guid).to.equal('2000');
				expect(orgs[0].name).to.equal('Bar org');
				expect(orgs[0].default).to.equal(false);
				expect(orgs[1].guid).to.equal('1000');
				expect(orgs[1].name).to.equal('Foo org');
				expect(orgs[1].default).to.equal(true);
			});

			it('should error if account is not a platform account', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.list()).to.eventually.be.rejectedWith(TypeError, 'Account required');
				await expect(sdk.org.list({})).to.eventually.be.rejectedWith(Error, 'Account must be a platform account');
			});

			it('should error if default org is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.list(account, {})).to.eventually.be.rejectedWith(TypeError, 'Expected organization identifier');
				await expect(sdk.org.list(account, 'wiz')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "wiz"');
			});
		});

		describe('family()', () => {
			afterEach(stopServer);

			it('should get org family', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const family = await sdk.org.family(account, 100);
				expect(family).to.be.an('object');
				expect(family.children).to.be.an('array');
				expect(family.children).to.have.lengthOf(1);
			});
		});

		describe('find()', () => {
			afterEach(stopServer);

			it('should find an org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let org = await sdk.org.find(account, 100);
				expect(org.guid).to.equal('1000');

				org = await sdk.org.find(account, '1000');
				expect(org.guid).to.equal('1000');

				org = await sdk.org.find(account, 'Foo org');
				expect(org.guid).to.equal('1000');

				await expect(sdk.org.find(account, 'wiz')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "wiz"');
			});

			it('should find an org with a parent org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let org = await sdk.org.find(account, 200);
				expect(org.guid).to.equal('2000');
				expect(org.parentOrg.guid).to.equal('1000');
			});
		});

		describe('environments()', () => {
			afterEach(stopServer);

			it('should get org environments', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const envs = await sdk.org.environments(account);
				expect(envs).to.deep.equal([
					{
						name: 'production',
						isProduction: true
					},
					{
						name: 'development',
						isProduction: false
					}
				]);
			});
		});

		describe('rename()', () => {
			afterEach(stopServer);

			it('should get rename an org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const org = await sdk.org.rename(account, 100, 'Wiz org');
				expect(org.name).to.equal('Wiz org');
			});
		});

		describe('activity()', () => {
			afterEach(stopServer);

			it('should get org activity with default date range', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const activity = await sdk.org.activity(account);
				expect(activity.events).to.have.lengthOf(0);
			});

			it('should org activity with date range', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let activity = await sdk.org.activity(account, 100, {
					from: '2021-02-04',
					to: '2021-02-10'
				});
				expect(activity.events).to.have.lengthOf(1);

				activity = await sdk.org.activity(account, 100, {
					from: '2021-02-01',
					to: '2021-02-20'
				});
				expect(activity.events).to.have.lengthOf(3);
			});

			it('should error getting org activity for non-existing org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.activity(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error getting org activity if dates are invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.activity(account, 100, { from: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "from" date to be in the format YYYY-MM-DD');
				await expect(sdk.org.activity(account, 100, { to: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "to" date to be in the format YYYY-MM-D');
			});
		});

		describe('usage()', () => {
			afterEach(stopServer);

			it('should get org usage with default date range', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const { usage } = await sdk.org.usage(account);
				expect(usage.SaaS).to.deep.equal({
					apiRateMonth:      { name: 'API Calls',          quota: 5000,     value: 0, unit: 'Calls' },
					pushRateMonth:     { name: 'Push Notifications', quota: 2000,     value: 0, unit: 'Calls' },
					storageFilesGB:    { name: 'File Storage',       quota: 100,      value: 0, unit: 'GB' },
					storageDatabaseGB: { name: 'Database Storage',   quota: 100,      value: 0, unit: 'GB' },
					containerPoints:   { name: 'Container Points',   quota: 1000,     value: 0, unit: 'Points' },
					eventRateMonth:    { name: 'Analytics Events',   quota: 10000000, value: 0, unit: 'Events' }
				});
			});

			it('should org usage with date range', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { usage } = await sdk.org.usage(account, 100, {
					from: '2021-02-04',
					to: '2021-02-10'
				});
				expect(usage.SaaS).to.deep.equal({
					apiRateMonth:      { name: 'API Calls',          quota: 5000,     value: 784, unit: 'Calls' },
					pushRateMonth:     { name: 'Push Notifications', quota: 2000,     value: 167, unit: 'Calls' },
					storageFilesGB:    { name: 'File Storage',       quota: 100,      value: 0, unit: 'GB' },
					storageDatabaseGB: { name: 'Database Storage',   quota: 100,      value: 0.14 + 0.07, unit: 'GB' },
					containerPoints:   { name: 'Container Points',   quota: 1000,     value: 906, unit: 'Points' },
					eventRateMonth:    { name: 'Analytics Events',   quota: 10000000, value: 190666, unit: 'Events' }
				});

				({ usage } = await sdk.org.usage(account, 100, {
					from: '2021-02-01',
					to: '2021-02-20'
				}));
				expect(usage.SaaS).to.deep.equal({
					apiRateMonth:      { name: 'API Calls',          quota: 5000,     value: 1294, unit: 'Calls' },
					pushRateMonth:     { name: 'Push Notifications', quota: 2000,     value: 1211, unit: 'Calls' },
					storageFilesGB:    { name: 'File Storage',       quota: 100,      value: 0.0013, unit: 'GB' },
					storageDatabaseGB: { name: 'Database Storage',   quota: 100,      value: 0.14 + 0.07 + 0.11, unit: 'GB' },
					containerPoints:   { name: 'Container Points',   quota: 1000,     value: 2266, unit: 'Points' },
					eventRateMonth:    { name: 'Analytics Events',   quota: 10000000, value: 423110, unit: 'Events' }
				});
			});

			it('should error getting org usage for non-existing org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.usage(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error getting org usage if dates are invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.usage(account, 100, { from: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "from" date to be in the format YYYY-MM-DD');
				await expect(sdk.org.usage(account, 100, { to: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "to" date to be in the format YYYY-MM-D');
			});
		});

		describe('users', () => {
			describe('list()', () => {
				afterEach(stopServer);
			});

			describe('find()', () => {
				afterEach(stopServer);
			});

			describe('add()', () => {
				afterEach(stopServer);
			});

			describe('update()', () => {
				afterEach(stopServer);
			});

			describe('remove()', () => {
				afterEach(stopServer);
			});
		});

		// sdk.org.user.list
		// sdk.org.user.find
		// sdk.org.user.add
		// sdk.org.user.update
		// sdk.org.user.remove
	});

	describe('Role', () => {
		afterEach(stopServer);

		it('should get roles for an org', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore();
			const sdk = createSDK({ tokenStore });

			const roles = await sdk.role.list(account);
			expect(roles).to.deep.equal([
				{
					id: 'administrator',
					name: 'Administrator',
					default: true,
					org: true,
					team: true
				},
				{
					id: 'developer',
					name: 'Developer',
					default: true,
					org: true,
					team: true
				},
				{
					id: 'some_admin',
					name: 'Some Admin',
					org: true
				}
			]);
		});

		it('should get roles for a team', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore();
			const sdk = createSDK({ tokenStore });

			const roles = await sdk.role.list(account, { team: true });
			expect(roles).to.deep.equal([
				{
					id: 'administrator',
					name: 'Administrator',
					default: true,
					org: true,
					team: true
				},
				{
					id: 'developer',
					name: 'Developer',
					default: true,
					org: true,
					team: true
				}
			]);
		});

		it('should fail to get roles', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const sdk = createSDK();
			await expect(sdk.role.list({})).to.eventually.be.rejectedWith(Error, 'Failed to get roles');
		});
	});

	describe('Team', () => {
		afterEach(stopServer);
	});

	describe('User', () => {
		afterEach(stopServer);
	});
});
