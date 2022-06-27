import AmplifySDK from '../src/index.js';
import fs from 'fs';
import path from 'path';
import { Account, UsageParams, User } from '../src/types.js';
import { createServer, stopServer } from './common.js';
import { expect } from 'chai';
import { fileURLToPath } from 'url';
import { resolveMonthRange } from '../src/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

describe('amplify-sdk', () => {
	describe('Error Handling', () => {
		it('should error if options is not an object', () => {
			expect(() => {
				new AmplifySDK('foo' as any);
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should create an SDK instance with non-existent environment', () => {
			const orig = process.env.AXWAY_CLI;
			process.env.AXWAY_CLI = '2.0.0';
			try {
				const sdk = new AmplifySDK();
				expect(sdk).to.be.an('object');
				// eslint-disable-next-line security/detect-non-literal-regexp
				expect(sdk.userAgent).to.match(new RegExp(`^AMPLIFY SDK\\/\\d\\.\\d\\.\\d(-.*)? \\(${process.platform}; ${process.arch}; node:${process.versions.node}\\) Axway CLI\\/2.0.0`));
			} finally {
				process.env.AXWAY_CLI = orig;
			}
		});
	});

	describe('Auth', () => {
		describe('Error Handling', () => {
			it('should error creating client if token store is invalid', () => {
				expect(() => {
					const client = createSDK({ tokenStore: 'foo' }).auth.client;
					expect(client).to.be.an('object');
				}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');
			});
		});

		describe('find()', () => {
			afterEach(stopServer);

			it('should find an existing platform account', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const acct = await sdk.auth.find('test_client:foo@bar.com') as Account;
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

				const acct = await sdk.auth.find('test_client:foo@bar.com') as Account;
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
				expect(account).to.equal(undefined);
			});
		});

		describe('findSession()', () => {
			afterEach(stopServer);

			it('should error if account is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.auth.findSession(undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Account required');
			});
		});

		describe('login()', () => {
			afterEach(stopServer);

			(isCI ? it.skip : it)('should authenticate using interactive login via PKCE', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const sdk = createSDK();

				const account = await sdk.auth.login() as Account;
				expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
				expect(account.name).to.equal('test_client:foo@bar.com');

				// try to log in again
				await expect(sdk.auth.login()).to.eventually.be.rejectedWith(Error, 'Account already authenticated');

				await expect(sdk.auth.logout({ accounts: 'foo' } as any)).to.eventually.be.rejectedWith(TypeError, 'Expected accounts to be a list of accounts');
				await sdk.auth.logout({ accounts: [] });
				await sdk.auth.logout({ all: true });
			});

			it('should error if authenticating with username and password without client secret or secret file', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const sdk = createSDK();

				await expect(sdk.auth.login({
					username: 'foo',
					password: 'bar'
				})).to.eventually.be.rejectedWith(Error, 'Username/password can only be specified when using client secret or secret file');
			});

			it('should error if authenticating with invalid username', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const sdk = createSDK();

				await expect(sdk.auth.login({
					username: 123 as any,
					clientSecret: '###',
					serviceAccount: true
				})).to.eventually.be.rejectedWith(TypeError, 'Expected username to be an email address');
			});

			it('should error if authenticating with missing password', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const sdk = createSDK();

				await expect(sdk.auth.login({
					username: 'foo',
					clientSecret: '###',
					serviceAccount: true
				})).to.eventually.be.rejectedWith(TypeError, 'Expected password to be a non-empty string');
			});

			it('should login with client secret, username and password', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const sdk = createSDK();

				const account = await sdk.auth.login({
					username: 'test1@domain.com',
					password: 'bar',
					clientSecret: '###',
					serviceAccount: true
				}) as Account;

				expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
				expect(account.isPlatform).to.equal(true);
				expect(account.org.guid).to.equal('1000');
				expect(account.orgs).to.have.lengthOf(1);
				expect(account.orgs[0].guid).to.equal(account.org.guid);
				expect(account.user.email).to.equal('test1@domain.com');
			});

			it('should error logging in with client secret and bad credentials', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const sdk = createSDK();

				await expect(sdk.auth.login({
					username: 'test1@domain.com',
					password: 'baz',
					clientSecret: '###',
					serviceAccount: true
				})).to.eventually.be.rejectedWith(Error, 'Failed to authenticate: Response code 401 (Unauthorized) (401)');
			});
		});

		describe('switchOrg()', () => {
			afterEach(stopServer);

			(isCI ? it.skip : it)('should authenticate if not logged in and switching org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const sdk = createSDK();

				const account = await sdk.auth.switchOrg() as Account;
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

				const acct = await sdk.auth.switchOrg(account) as Account;
				expect(acct.auth.tokens.access_token).to.equal(this.server.accessToken);
				expect(acct.name).to.equal('test_client:foo@bar.com');
			});

			(isCI ? it.skip : it)('should switch org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const acct = await sdk.auth.switchOrg(account) as Account;
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
		});

		describe('serverInfo()', () => {
			afterEach(stopServer);

			it('should get server info', async function () {
				this.server = await createServer();
				const sdk = createSDK({ tokenStoreType: null });
				expect(await sdk.auth.serverInfo()).to.be.an('object');
			});
		});
	});

	describe('Client', () => {
		describe('create()', () => {
			afterEach(stopServer);

			it('should error if options are invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, null as any)).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
				await expect(sdk.client.create(account, 100, 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
			});

			it('should error if name is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, {} as any)).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
				await expect(sdk.client.create(account, 100, { name: 123 } as any)).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
			});

			it('should error if description is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, { name: 'foo', desc: [] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected description to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', desc: 123 as any })).to.eventually.be.rejectedWith(TypeError, 'Expected description to be a string');
			});

			it('should error if public key is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, { name: 'foo', publicKey: [] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected public key to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', publicKey: 123 as any })).to.eventually.be.rejectedWith(TypeError, 'Expected public key to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', publicKey: 'baz' })).to.eventually.be.rejectedWith(Error, 'Expected public key to be PEM formatted');
			});

			it('should error if secret is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: [] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected secret to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 123 as any })).to.eventually.be.rejectedWith(TypeError, 'Expected secret to be a string');
			});

			it('should error if no public key or secret', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, { name: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected public key or secret');
			});

			it('should error if roles are invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', roles: 123 as any })).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', roles: 'pow' as any })).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
			});

			it('should error if teams are invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: 123 as any })).to.eventually.be.rejectedWith(TypeError, 'Expected teams to be an array');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: 'pow' as any })).to.eventually.be.rejectedWith(TypeError, 'Expected teams to be an array');

				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ 'pow' ] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ {} ] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ { guid: 123 } ] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ { guid: 'abc' } ] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ { guid: 'abc', roles: 123 } ] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ { guid: 'abc', roles: [] } ] as any })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');

				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ { guid: 'abc', roles: [ 'def' ] } ] })).to.eventually.be.rejectedWith(Error, 'Invalid team "abc"');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [ { guid: '60000', roles: [ 'def' ] } ] })).to.eventually.be.rejectedWith(Error, 'Invalid team role "def"');
			});

			it('should create a service account with a client secret', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				const { client } = await sdk.client.create(account, 100, { name: 'foo', secret: 'baz', roles: [], teams: [] });
				expect(client.name).to.equal('foo');
				expect(client.client_id).to.equal(`foo_${client.guid}`);
				expect(client.type).to.equal('secret');
			});

			it('should create a service account with a client secret and a team', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const { team } = await sdk.team.create(account, 100, 'C Team', { desc: 'The C Team' });
				let { client } = await sdk.client.create(account, 100, {
					name: 'foo',
					secret: 'baz',
					roles: [ 'some_admin' ],
					teams: [
						{ guid: team.guid, roles: [ 'developer' ] },
						{ guid: team.guid, roles: [ 'developer' ] } // test dedupe
					]
				});
				expect(client.name).to.equal('foo');
				expect(client.client_id).to.equal(`foo_${client.guid}`);
				expect(client.type).to.equal('secret');

				({ client } = await sdk.client.find(account, 100, client.client_id));
				expect(client.name).to.equal('foo');
				expect(client.client_id).to.equal(`foo_${client.guid}`);
				expect(client.type).to.equal('secret');
				expect(client.teams).to.have.lengthOf(1);
				expect(client.teams[0].name).to.equal('C Team');
			});

			it('should create a service account with a public key', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				const publicKey = fs.readFileSync(path.join(__dirname, 'resources', 'public_key.pem'), 'utf-8');
				const { client } = await sdk.client.create(account, 100, { name: 'foo', publicKey });
				expect(client.name).to.equal('foo');
				expect(client.client_id).to.equal(`foo_${client.guid}`);
				expect(client.type).to.equal('certificate');

				const { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(2);
				expect(clients[0].name).to.equal('foo');
				expect(clients[1].name).to.equal('Test');
			});
		});

		describe('find()', () => {
			afterEach(stopServer);

			it('should find a service account by name', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				const { client } = await sdk.client.find(account, 100, 'Test');
				expect(client.name).to.equal('Test');
				expect(client.description).to.equal('Test service account');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
			});

			it('should find a service account by client id', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				const { client } = await sdk.client.find(account, 100, 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.name).to.equal('Test');
				expect(client.description).to.equal('Test service account');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
			});

			it('should fail to find non-existent service account', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.find(account, 100, 'does_not_exist')).to.eventually.be.rejectedWith(Error, 'Service account "does_not_exist" not found');
			});
		});

		describe('generateKeyPair()', () => {
			it('should generate a key pair', async () => {
				const sdk = createSDK();
				const certs = await sdk.client.generateKeyPair();
				expect(certs.publicKey).to.include('-----BEGIN PUBLIC KEY-----');
				expect(certs.privateKey).to.include('-----BEGIN PRIVATE KEY-----');
			});
		});

		describe('list()', () => {
			afterEach(stopServer);

			it('should return no clients for org with one client', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				const { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(1);
			});

			it('should return no clients for org with no clients', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				const { clients } = await sdk.client.list(account, 200);
				expect(clients).to.have.lengthOf(0);
			});
		});

		describe('remove()', () => {
			afterEach(stopServer);

			it('should error removing a service account if client id is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.remove(account, 100, {} as any)).to.eventually.be.rejectedWith(TypeError, 'Expected client to be an object or client id');
			});

			it('should error removing a service account if not found', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.remove(account, 100, 'does_not_exist')).to.eventually.be.rejectedWith(Error, 'Service account "does_not_exist" not found');
			});

			it('should remove a service account by name', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const { client } = await sdk.client.remove(account, 100, 'Test');
				expect(client.name).to.equal('Test');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');

				const { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(0);
			});

			it('should remove a service account by client id', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const { client } = await sdk.client.remove(account, 100, 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.name).to.equal('Test');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');

				const { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(0);
			});
		});

		describe('update()', () => {
			afterEach(stopServer);

			it('should error updaing a service account if options are invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.update(account, 100, 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
			});

			it('should error updaing a service account if client id is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.update(account, 100, { client: {} } as any)).to.eventually.be.rejectedWith(TypeError, 'Expected client to be an object or client id');
			});

			it('should error updating a service account if not found', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });
				await expect(sdk.client.update(account, 100, { client: 'does_not_exist' })).to.eventually.be.rejectedWith(Error, 'Service account "does_not_exist" not found');
			});

			it('should update a service account by name', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { client } = await sdk.client.update(account, 100, {
					client: 'Test',
					name: 'Test2',
					desc: 'This is test 2 now',
					secret: 'abc123'
				});
				expect(client.name).to.equal('Test2');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.description).to.equal('This is test 2 now');

				({ client } = await sdk.client.find(account, 100, 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad'));
				expect(client.name).to.equal('Test2');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.description).to.equal('This is test 2 now');
			});

			it('should update a service account by id', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { client } = await sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					name: 'Test2',
					desc: 'This is test 2 now'
				});
				expect(client.name).to.equal('Test2');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.description).to.equal('This is test 2 now');

				({ client } = await sdk.client.find(account, 100, 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad'));
				expect(client.name).to.equal('Test2');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.description).to.equal('This is test 2 now');
			});

			it('should error if name is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					name: [] as any
				})).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
			});

			it('should error if description is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					desc: [] as any
				})).to.eventually.be.rejectedWith(TypeError, 'Expected description to be a string');
			});

			it('should error if public key is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					publicKey: [] as any
				})).to.eventually.be.rejectedWith(TypeError, 'Expected public key to be a string');

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					publicKey: 'foo'
				})).to.eventually.be.rejectedWith(Error, 'Expected public key to be PEM formatted');
			});

			it('should error if secret is invalid', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					secret: [] as any
				})).to.eventually.be.rejectedWith(TypeError, 'Expected secret to be a string');
			});

			it('should error trying to change auth method', async function () {
				this.server = await createServer();
				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					publicKey: fs.readFileSync(path.join(__dirname, 'resources', 'public_key.pem'), 'utf-8')
				})).to.eventually.be.rejectedWith(Error, 'Service account "Test" uses auth method "Client Secret" and cannot be changed to "Client Certificate"');
			});
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

				await expect(sdk.org.list(undefined as any, undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Account required');
				await expect(sdk.org.list({} as any, undefined as any)).to.eventually.be.rejectedWith(Error, 'Account must be a platform account');
			});

			it('should error if default org is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.list(account, {} as any)).to.eventually.be.rejectedWith(TypeError, 'Expected organization identifier');
				await expect(sdk.org.list(account, 'wiz')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "wiz"');
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
						guid: undefined,
						name: 'production',
						isProduction: true
					},
					{
						guid: undefined,
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

			it('should error if new name is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.org.rename(account, 100, undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Organization name must be a non-empty string');
				await expect(sdk.org.rename(account, 100, 123 as any)).to.eventually.be.rejectedWith(TypeError, 'Organization name must be a non-empty string');
				await expect(sdk.org.rename(account, 100, '')).to.eventually.be.rejectedWith(TypeError, 'Organization name must be a non-empty string');
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
				} as UsageParams);
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
				} as UsageParams));
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

				await expect(sdk.org.usage(account, 100, { from: 'foo' } as any)).to.eventually.be.rejectedWith(Error, 'Expected "from" date to be in the format YYYY-MM-DD');
				await expect(sdk.org.usage(account, 100, { to: 'foo' } as any)).to.eventually.be.rejectedWith(Error, 'Expected "to" date to be in the format YYYY-MM-D');
			});
		});

		describe('users', () => {
			describe('list()', () => {
				afterEach(stopServer);

				it('should list all users in an org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					let { users } = await sdk.org.userList(account);
					expect(users).to.deep.equal([
						{
							client_id: undefined,
							guid: '50000',
							email: 'test1@domain.com',
							firstname: 'Test1',
							lastname: 'Tester1',
							name: 'Test1 Tester1',
							primary: true,
							roles: [ 'administrator' ]
						},
						{
							client_id: undefined,
							guid: '50001',
							email: 'test2@domain.com',
							firstname: 'Test2',
							lastname: 'Tester2',
							name: 'Test2 Tester2',
							primary: true,
							roles: [ 'developer' ]
						},
						{
							client_id: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
							email: undefined,
							firstname: undefined,
							guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
							lastname: undefined,
							name: 'Test',
							primary: undefined,
							roles: [ 'developer' ]
						}
					]);

					({ users } = await sdk.org.userList(account, '2000'));
					expect(users).to.deep.equal([
						{
							client_id: undefined,
							guid: '50000',
							email: 'test1@domain.com',
							firstname: 'Test1',
							lastname: 'Tester1',
							name: 'Test1 Tester1',
							primary: true,
							roles: [ 'administrator' ]
						}
					]);
				});

				it('should error getting users for non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userList(account, 300)).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});
			});

			describe('find()', () => {
				afterEach(stopServer);

				it('should find an org user by guid', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const user = await sdk.org.userFind(account, 100, '50000');
					expect(user).to.deep.equal({
						client_id: undefined,
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						primary: true,
						roles: [ 'administrator' ]
					});
				});

				it('should find an org user by email', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const user = await sdk.org.userFind(account, 100, 'test2@domain.com');
					expect(user).to.deep.equal({
						client_id: undefined,
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						primary: true,
						roles: [ 'developer' ]
					});
				});

				it('should error finding an non-existing org user', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const user = await sdk.org.userFind(account, 100, '12345');
					expect(user).to.be.undefined;
				});
			});

			describe('add()', () => {
				afterEach(stopServer);

				it('should add a user to an org by email', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					expect(await sdk.org.userFind(account, 100, 'test3@domain.com')).to.be.undefined;

					const { user } = await sdk.org.userAdd(account, 100, 'test3@domain.com', [ 'developer' ]);
					expect((user as User).guid).to.deep.equal('50002');

					expect(await sdk.org.userFind(account, 100, 'test3@domain.com')).to.deep.equal({
						client_id: undefined,
						guid: '50002',
						email: 'test3@domain.com',
						firstname: 'Test3',
						lastname: 'Tester3',
						name: 'Test3 Tester3',
						primary: true,
						roles: [ 'developer' ]
					});

					await expect(sdk.org.userAdd(account, 100, 'test3@domain.com', [ 'developer' ])).to.eventually.be
						.rejectedWith(Error, 'Failed to add user to organization: User is already a member of this org. (400)');
				});

				it('should error adding add a user to a non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userAdd(account, 300, '', [])).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userAdd(account, 100, '12345', undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.userAdd(account, 100, '12345', 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.userAdd(account, 100, '12345', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.org.userAdd(account, 100, '12345', [ 'foo' ])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer, some_admin');
				});

				it('should error if roles does not include a default role', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userAdd(account, 100, '12345', [ 'some_admin' ])).to.eventually.be.rejectedWith(Error, 'You must specify a default role: administrator, developer');
				});
			});

			describe('update()', () => {
				afterEach(stopServer);

				it('should update an org user\'s role', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const { user } = await sdk.org.userUpdate(account, 100, '50001', [ 'administrator' ]);
					expect(user).to.deep.equal({
						client_id: undefined,
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						primary: true,
						roles: [ 'administrator' ]
					});
				});

				it('should error updating user role for non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userUpdate(account, 300, '50001', [ 'administrator' ])).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});

				it('should error update user role for user not in an org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userUpdate(account, 100, '50002', [ 'administrator' ])).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userUpdate(account, 100, '50001', undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.userUpdate(account, 100, '50001', 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.userUpdate(account, 100, '50001', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.org.userUpdate(account, 100, '50001', [ 'foo' ])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer, some_admin');
				});
			});

			describe('remove()', () => {
				afterEach(stopServer);

				it('should remove a user from an org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					expect((await sdk.org.userList(account, 100)).users).to.have.lengthOf(3);
					await sdk.org.userRemove(account, 100, '50001');
					expect((await sdk.org.userList(account, 100)).users).to.have.lengthOf(2);
				});

				it('should error removing a user from a non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userRemove(account, 300, '50001')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});

				it('should error removing a user that does not currently belong to an org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.org.userRemove(account, 100, '50002')).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});
			});
		});
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
					org: true,
					client: true
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

		it('should get client roles', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const { account, tokenStore } = this.server.createTokenStore();
			const sdk = createSDK({ tokenStore });

			const roles = await sdk.role.list(account, { client: true });
			expect(roles).to.deep.equal([
				{
					id: 'some_admin',
					name: 'Some Admin',
					org: true,
					client: true
				}
			]);
		});

		it('should fail to get roles', async function () {
			this.timeout(10000);
			this.server = await createServer();

			const sdk = createSDK();
			await expect(sdk.role.list({} as any)).to.eventually.be.rejectedWith(Error, 'Failed to get roles');
		});
	});

	describe('Team', () => {
		describe('list()', () => {
			afterEach(stopServer);

			it('should list all teams for an org', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { teams } = await sdk.team.list(account, 100);
				expect(teams).to.have.lengthOf(1);
				expect(teams[0].name).to.equal('A Team');

				({ teams } = await sdk.team.list(account, 200));
				expect(teams).to.have.lengthOf(2);
				expect(teams[0].name).to.equal('B Team');
				expect(teams[1].name).to.equal('B Team');
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.list(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});
		});

		describe('find()', () => {
			afterEach(stopServer);

			it('should find a team by guid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const { team } = await sdk.team.find(account, '1000', '60000');
				expect(team.name).to.equal('A Team');
			});

			it('should find a team by name', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { team } = await sdk.team.find(account, '1000', 'A Team');
				expect(team.name).to.equal('A Team');

				({ team } = await sdk.team.find(account, '1000', 'a team'));
				expect(team.name).to.equal('A Team');

				({ team } = await sdk.team.find(account, '1000', 'A TEAM'));
				expect(team.name).to.equal('A Team');
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.find(account, 'abc', undefined as any)).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.find(account, 100, undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Expected team to be a name or guid');
				await expect(sdk.team.find(account, 100, 123 as any)).to.eventually.be.rejectedWith(TypeError, 'Expected team to be a name or guid');
			});

			it('should error if team not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.find(account, 100, 'foo')).to.eventually.be.rejectedWith(Error, 'Unable to find team "foo" in the "Foo org" organization');
			});
		});

		describe('create()', () => {
			afterEach(stopServer);

			it('should create a new team', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { team } = await sdk.team.create(account, 100, 'C Team', { desc: 'The C Team' });
				expect(team.name).to.equal('C Team');
				expect(team.desc).to.equal('The C Team');
				expect(team.guid).to.be.ok;

				({ team } = await sdk.team.find(account, 100, team.guid));
				expect(team.name).to.equal('C Team');
				expect(team.desc).to.equal('The C Team');
			});

			it('should error if team name is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.create(account, 100, undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
				await expect(sdk.team.create(account, 100, 123 as any)).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
				await expect(sdk.team.create(account, 100, '')).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.create(account, 'abc', '', {})).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team info is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.create(account, 100, 'C Team', 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected team info to be an object');
				await expect(sdk.team.create(account, 100, 'C Team', { tags: 'foo' } as any)).to.eventually.be.rejectedWith(TypeError, 'Expected team tags to be an array of strings');
			});
		});

		describe('update()', () => {
			afterEach(stopServer);

			it('should update a team\'s info', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { team } = await sdk.team.find(account, 100, 'A Team');
				expect(team.name).to.equal('A Team');
				expect(team.desc).to.equal(undefined);
				expect(team.guid).to.equal('60000');
				expect(team.default).to.equal(true);
				expect(team.tags).to.deep.equal([]);

				await sdk.team.update(account, 100, team.guid, {
					desc: 'The D Team',
					name: 'D Team',
					default: false,
					tags: [ 'abc', 'def' ]
				});

				({ team } = await sdk.team.find(account, 100, team.guid));
				expect(team.name).to.equal('D Team');
				expect(team.desc).to.equal('The D Team');
				expect(team.guid).to.equal('60000');
				expect(team.default).to.equal(false);
				expect(team.tags).to.deep.equal([ 'abc', 'def' ]);
			});

			it('should not error if no info to update', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const { team } = await sdk.team.update(account, 100, 'A Team', {});
				expect(team.name).to.equal('A Team');
				expect(team.desc).to.equal(undefined);
				expect(team.guid).to.equal('60000');
				expect(team.default).to.equal(true);
				expect(team.tags).to.deep.equal([]);
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.update(account, 'abc', 'A Team', {})).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team is not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.update(account, 100, 'C Team', {})).to.eventually.be.rejectedWith(Error, 'Unable to find team "C Team" in the "Foo org" organization');
			});
		});

		describe('remove()', () => {
			afterEach(stopServer);

			it('should remove a team', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { teams } = await sdk.team.list(account, 100);
				expect(teams).to.have.lengthOf(1);

				await sdk.team.remove(account, 100, 'A Team');

				({ teams } = await sdk.team.list(account, 100));
				expect(teams).to.have.lengthOf(0);
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.remove(account, 'abc', 'A Team')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team is not found', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.team.remove(account, 100, 'C Team')).to.eventually.be.rejectedWith(Error, 'Unable to find team "C Team" in the "Foo org" organization');
			});
		});

		describe('users', () => {
			describe('list()', () => {
				afterEach(stopServer);

				it('should list all users in a team', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					let { users } = await sdk.team.userList(account, 100, '60000');
					expect(users).to.have.lengthOf(2);

					({ users } = await sdk.team.userList(account, 200, '60001'));
					expect(users).to.have.lengthOf(1);
				});

				it('should error getting users for non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userList(account, 'abc', '60000')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error getting users if team is not found', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userList(account, 100, 'Z Team')).to.eventually.be.rejectedWith(Error, 'Unable to find team "Z Team" in the "Foo org" organization');
				});
			});

			describe('find()', () => {
				afterEach(stopServer);

				it('should find a team user by guid', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const { user } = await sdk.team.userFind(account, 100, '60000', '50000');
					expect(user).to.deep.equal({
						client_id: undefined,
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						roles: [ 'administrator' ],
						type: 'user'
					});
				});

				it('should find an team user by email', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const { user } = await sdk.team.userFind(account, 100, '60000', 'test1@domain.com');
					expect(user).to.deep.equal({
						client_id: undefined,
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						roles: [ 'administrator' ],
						type: 'user'
					});
				});

				it('should error finding an non-existing team user', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const { user } = await sdk.team.userFind(account, 100, '60000', '12345');
					expect(user).to.be.undefined;
				});
			});

			describe('add()', () => {
				afterEach(stopServer);

				it('should add a user to a team by email', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					expect((await sdk.team.userFind(account, 100, '60000', 'test2@domain.com')).user).to.be.undefined;

					const { user } = await sdk.team.userAdd(account, 100, '60000', 'test2@domain.com', [ 'developer' ]);
					expect(user.guid).to.deep.equal('50001');

					expect((await sdk.team.userFind(account, 100, '60000', 'test2@domain.com')).user).to.deep.equal({
						client_id: undefined,
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						roles: [ 'developer' ],
						type: 'user'
					});

					await expect(sdk.team.userAdd(account, 100, '60000', 'test2@domain.com', [ 'developer' ])).to.eventually.be
						.rejectedWith(Error, 'Failed to add user to organization: User is already a member of this team. (400)');
				});

				it('should add a user to a team by user guid', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					expect((await sdk.team.userFind(account, 100, '60000', '50001')).user).to.be.undefined;

					const { user } = await sdk.team.userAdd(account, 100, '60000', '50001', [ 'developer' ]);
					expect(user.guid).to.deep.equal('50001');

					expect((await sdk.team.userFind(account, 100, '60000', '50001')).user).to.deep.equal({
						client_id: undefined,
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						roles: [ 'developer' ],
						type: 'user'
					});

					await expect(sdk.team.userAdd(account, 100, '60000', '50001', [ 'developer' ])).to.eventually.be
						.rejectedWith(Error, 'Failed to add user to organization: User is already a member of this team. (400)');
				});

				it('should error adding add a user to a team for a non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userAdd(account, 'abc', '', '', [])).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userAdd(account, 100, '60000', '50001', undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.userAdd(account, 100, '60000', '50001', 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.userAdd(account, 100, '60000', '50001', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.team.userAdd(account, 100, '60000', '50001', [ 'foo' ])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer');
				});
			});

			describe('update()', () => {
				afterEach(stopServer);

				it('should update an team user\'s role', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					const { user } = await sdk.team.userUpdate(account, 100, '60000', '50000', [ 'developer' ]);
					expect(user).to.deep.equal({
						client_id: undefined,
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						roles: [ 'developer' ],
						type: 'user'
					});
				});

				it('should error updating user role for non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userUpdate(account, 'abc', '60000', '50001', [ 'administrator' ])).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error update user\'s team role for user not in an org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userUpdate(account, 100, '60000', '50002', [ 'administrator' ])).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userUpdate(account, 100, '60000', '50000', undefined as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.userUpdate(account, 100, '60000', '50000', 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.userUpdate(account, 100, '60000', '50000', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.team.userUpdate(account, 100, '60000', '50000', [ 'foo' ])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer');
				});

				it('should error if user not apart of the team', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userUpdate(account, 100, '60000', '50002', [ 'developer' ])).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});

				it('should error updating user if team is not found', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userUpdate(account, 100, 'Z Team', '50000', [ 'developer' ])).to.eventually.be.rejectedWith(Error, 'Unable to find team "Z Team" in the "Foo org" organization');
				});
			});

			describe('remove()', () => {
				afterEach(stopServer);

				it('should remove a user from a team', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					expect((await sdk.team.userList(account, 100, '60000')).users).to.have.lengthOf(2);
					await sdk.team.userRemove(account, 100, '60000', '50000');
					expect((await sdk.team.userList(account, 100, '60000')).users).to.have.lengthOf(1);
				});

				it('should error removing a user from a non-existing org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userRemove(account, 'abc', '60000', '50001')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error removing a user that does not currently belong to an org', async function () {
					this.timeout(10000);
					this.server = await createServer();

					const { account, tokenStore } = this.server.createTokenStore();
					const sdk = createSDK({ tokenStore });

					await expect(sdk.team.userRemove(account, 100, '60000', '50002')).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});
			});
		});
	});

	describe('User', () => {
		describe('find()', () => {
			afterEach(stopServer);

			it('should find a user by guid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let user = await sdk.user.find(account, '50000');
				expect(user.guid).to.equal('50000');
				expect(user.firstname).to.equal('Test1');
				expect(user.lastname).to.equal('Tester1');
				expect(user.email).to.equal('test1@domain.com');

				user = await sdk.user.find(account, '50001');
				expect(user.guid).to.equal('50001');
				expect(user.firstname).to.equal('Test2');
				expect(user.lastname).to.equal('Tester2');
				expect(user.email).to.equal('test2@domain.com');

				user = await sdk.user.find(account, user);
				expect(user.guid).to.equal('50001');
				expect(user.firstname).to.equal('Test2');
				expect(user.lastname).to.equal('Tester2');
				expect(user.email).to.equal('test2@domain.com');
			});

			it('should find a user by email', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let user = await sdk.user.find(account, 'test1@domain.com');
				expect(user.guid).to.equal('50000');
				expect(user.firstname).to.equal('Test1');
				expect(user.lastname).to.equal('Tester1');
				expect(user.email).to.equal('test1@domain.com');

				user = await sdk.user.find(account, 'test2@domain.com');
				expect(user.guid).to.equal('50001');
				expect(user.firstname).to.equal('Test2');
				expect(user.lastname).to.equal('Tester2');
				expect(user.email).to.equal('test2@domain.com');
			});

			it('should fail to find non-existing user', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.user.find(account, 'foo@bar.com')).to.eventually.be.rejectedWith(Error, 'User "foo@bar.com" not found');
				await expect(sdk.user.find(account, '12345')).to.eventually.be.rejectedWith(Error, 'User "12345" not found');
			});
		});

		describe('update()', () => {
			afterEach(stopServer);

			it('should update current user\'s info', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const { changes } = await sdk.user.update(account, {
					firstname: 'Foo',
					lastname: 'Bar'
				});

				expect(changes).to.deep.equal({
					firstname: {
						v: 'Foo',
						p: 'Test1'
					},
					lastname: {
						v: 'Bar',
						p: 'Tester1'
					}
				});

				const user = await sdk.user.find(account, '50000');
				expect(user.firstname).to.equal('Foo');
				expect(user.lastname).to.equal('Bar');
			});

			it('should not error if no info to update', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let { changes } = await sdk.user.update(account);
				expect(changes).to.deep.equal({});

				({ changes } = await sdk.user.update(account, {}));
				expect(changes).to.deep.equal({});

				({ changes } = await sdk.user.update(account, { firstname: 'Test1' }));
				expect(changes).to.deep.equal({});
			});

			it('should error if info is invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.user.update(account, 'foo' as any)).to.eventually.be.rejectedWith(TypeError, 'Expected user info to be an object');
			});
		});

		describe('activity()', () => {
			afterEach(stopServer);

			it('should get user activity with default date range', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				const activity = await sdk.user.activity(account);
				expect(activity.events).to.have.lengthOf(0);
			});

			it('should user activity with date range', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				let activity = await sdk.user.activity(account, {
					from: '2021-02-04',
					to: '2021-02-10'
				});
				expect(activity.events).to.have.lengthOf(3);

				activity = await sdk.user.activity(account, {
					from: '2021-02-01',
					to: '2021-02-20'
				});
				expect(activity.events).to.have.lengthOf(4);
			});

			it('should error getting user activity if dates are invalid', async function () {
				this.timeout(10000);
				this.server = await createServer();

				const { account, tokenStore } = this.server.createTokenStore();
				const sdk = createSDK({ tokenStore });

				await expect(sdk.user.activity(account, { from: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "from" date to be in the format YYYY-MM-DD');
				await expect(sdk.user.activity(account, { to: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "to" date to be in the format YYYY-MM-D');
			});
		});
	});

	describe('resolveMonthRange', () => {
		it('should error if month is invalid', () => {
			expect(() => {
				resolveMonthRange(undefined as any);
			}).to.throw(TypeError, 'Expected month to be in the format YYYY-MM or MM');

			expect(() => {
				resolveMonthRange({} as any);
			}).to.throw(TypeError, 'Expected month to be in the format YYYY-MM or MM');

			expect(() => {
				resolveMonthRange('foo');
			}).to.throw(TypeError, 'Expected month to be in the format YYYY-MM or MM');
		});

		it('should return current month', () => {
			const r = resolveMonthRange(true);
			expect(r.from).to.match(/^\d{4}-\d{2}-01$/);
			expect(r.to).to.match(/^\d{4}-\d{2}-\d{2}$/);
		});

		it('should return range from single digit month', () => {
			const r = resolveMonthRange('3');
			expect(r.from).to.match(/^\d{4}-03-01$/);
			expect(r.to).to.match(/^\d{4}-03-31$/);
		});

		it('should return range from single numeric digit month', () => {
			const r = resolveMonthRange(6);
			expect(r.from).to.match(/^\d{4}-06-01$/);
			expect(r.to).to.match(/^\d{4}-06-30$/);
		});

		it('should return range from leading zero single digit month', () => {
			const r = resolveMonthRange('04');
			expect(r.from).to.match(/^\d{4}-04-01$/);
			expect(r.to).to.match(/^\d{4}-04-30$/);
		});

		it('should return range from year and month', () => {
			const r = resolveMonthRange('2020-05');
			expect(r.from).to.equal('2020-05-01');
			expect(r.to).to.equal('2020-05-31');
		});

		it('should error if month is out of range', () => {
			expect(() => {
				resolveMonthRange('13');
			}).to.throw(RangeError, 'Invalid month "13"');
		});

		it('should handle leap year', () => {
			const r = resolveMonthRange('2020-02');
			expect(r.from).to.equal('2020-02-01');
			expect(r.to).to.equal('2020-02-29');
		});
	});
});
