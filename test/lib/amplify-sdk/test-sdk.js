import AmplifySDK from '../../../dist/lib/amplify-sdk/index.js';
import fs from 'fs';
import path from 'path';
import { createSdkSync } from '../../helpers/index.js';
import { resolveMonthRange } from '../../../dist/lib/amplify-sdk/amplify-sdk.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUrl = 'http://127.0.0.1:8555';
const secretFilePath = path.join(__dirname, '../../helpers/private_key.pem');

describe('amplify-sdk', () => {
	describe('Error Handling', () => {
		it('should error if options is not an object', () => {
			expect(() => {
				new AmplifySDK('foo');
			}).to.throw(TypeError, 'Expected options to be an object');
		});
	});

	describe('Auth', () => {
		describe('Error Handling', () => {
			it('should error creating client if token store is invalid', () => {
				expect(() => {
					const client = new AmplifySDK({
						baseUrl,
						clientId: 'test_client',
						platformUrl: 'http://127.0.0.1:8666',
						realm: 'test_realm',
						tokenStore: 'foo'
					}).authClient;
					expect(client).to.be.an('object');
				}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');
			});
		});

		describe('find()', () => {

			it('should find an existing service account', async function () {
				this.timeout(10000);
				const { account, sdk, tokenStore } = await createSdkSync(true);

				const acct = await sdk.auth.find('test-auth-client-secret');
				expect(acct.name).to.equal('test-auth-client-secret');
				expect(acct.auth).to.be.an('object');
				expect(acct.auth.baseUrl).to.equal(baseUrl);
				expect(acct.auth.expires).to.equal(account.auth.expires);
				expect(acct.auth.tokens).to.be.an('object');
				expect(acct.auth.tokens.access_token).to.be.a('string');
				expect(acct.auth.tokens.id_token).to.be.a('string');

				const accounts = await sdk.auth.list();
				expect(accounts).to.have.lengthOf(1);
			});

			it('should not find an non-existing account', async function () {
				this.timeout(10000);
				const { account, sdk, tokenStore } = await createSdkSync(true);

				const acct = await sdk.auth.find('bar');
				expect(acct).to.equal(null);
			});
		});

		describe('findSession()', () => {

			it('should error if account is invalid', async function () {
				this.timeout(10000);
				const { account, sdk, tokenStore } = await createSdkSync();
				await expect(sdk.auth.findSession()).to.eventually.be.rejectedWith(TypeError, 'Account required');
			});
		});

		describe('login()', () => {

			it('should login with client secret', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync();

				const acct = await sdk.auth.login({
					clientId: 'test-auth-client-secret',
					clientSecret: 'shhhh'
				});

				expect(acct.auth.tokens.access_token).to.be.a('string');
				expect(acct.org.guid).to.equal('1000');
				expect(acct.orgs).to.have.lengthOf(1);
				expect(acct.orgs[0].guid).to.equal(acct.org.guid);
			});

			it('should error logging in with client secret and bad credentials', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync();

				await expect(sdk.auth.login({
					clientId: 'test-auth-client-secret',
					clientSecret: '###'
				})).to.eventually.be.rejectedWith(Error, 'Authentication failed: Response code 401 (Unauthorized)');
			});
		});

		describe('serverInfo()', () => {

			it('should get server info', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync();
				expect(await sdk.auth.serverInfo()).to.be.an('object');
			});
		});
	});

	describe('Client', () => {
		describe('create()', () => {

			it('should error if options are invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, null)).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
				await expect(sdk.client.create(account, 100, 'foo')).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
			});

			it('should error if name is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, {})).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
				await expect(sdk.client.create(account, 100, { name: 123 })).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
			});

			it('should error if description is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, { name: 'foo', desc: [] })).to.eventually.be.rejectedWith(TypeError, 'Expected description to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', desc: 123 })).to.eventually.be.rejectedWith(TypeError, 'Expected description to be a string');
			});

			it('should error if public key is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, { name: 'foo', publicKey: [] })).to.eventually.be.rejectedWith(TypeError, 'Expected public key to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', publicKey: 123 })).to.eventually.be.rejectedWith(TypeError, 'Expected public key to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', publicKey: 'baz' })).to.eventually.be.rejectedWith(Error, 'Expected public key to be PEM formatted');
			});

			it('should error if secret is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: [] })).to.eventually.be.rejectedWith(TypeError, 'Expected secret to be a string');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 123 })).to.eventually.be.rejectedWith(TypeError, 'Expected secret to be a string');
			});

			it('should error if no public key or secret', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, { name: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected public key or secret');
			});

			it('should error if roles are invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', roles: 123 })).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', roles: 'pow' })).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
			});

			it('should error if teams are invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: 123 })).to.eventually.be.rejectedWith(TypeError, 'Expected teams to be an array');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: 'pow' })).to.eventually.be.rejectedWith(TypeError, 'Expected teams to be an array');

				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: ['pow'] })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [{}] })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [{ guid: 123 }] })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [{ guid: 'abc' }] })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [{ guid: 'abc', roles: 123 }] })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [{ guid: 'abc', roles: [] }] })).to.eventually.be.rejectedWith(TypeError, 'Expected team to be an object containing a guid and array of roles');

				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [{ guid: 'abc', roles: ['def'] }] })).to.eventually.be.rejectedWith(Error, 'Invalid team "abc"');
				await expect(sdk.client.create(account, 100, { name: 'foo', secret: 'baz', teams: [{ guid: '60000', roles: ['def'] }] })).to.eventually.be.rejectedWith(Error, 'Invalid team role "def"');
			});

			it('should create a service account with a client secret', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				const { client } = await sdk.client.create(account, 100, { name: 'foo', secret: 'baz', roles: [], teams: [] });
				expect(client.name).to.equal('foo');
				expect(client.client_id).to.equal(`foo_${client.guid}`);
				expect(client.type).to.equal('secret');
			});

			it('should create a service account with a client secret and a team', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const { team } = await sdk.team.create(account, 100, 'C Team', { desc: 'The C Team' });

				let { client } = await sdk.client.create(account, 100, {
					name: 'foo',
					secret: 'baz',
					roles: ['some_admin'],
					teams: [
						{ guid: team.guid, roles: ['developer'] },
						{ guid: team.guid, roles: ['developer'] } // test dedupe
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
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				const publicKey = fs.readFileSync(path.join(__dirname, '../../helpers/public_key.pem'), 'utf-8');
				const { client } = await sdk.client.create(account, 100, { name: 'foo', publicKey });
				expect(client.name).to.equal('foo');
				expect(client.client_id).to.equal(`foo_${client.guid}`);
				expect(client.type).to.equal('certificate');

				const { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(3);
				expect(clients[0].name).to.equal('foo');
				expect(clients[1].name).to.equal('Test');
			});
		});

		describe('find()', () => {

			it('should find a service account by name', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				const { client } = await sdk.client.find(account, 100, 'Test');
				expect(client.name).to.equal('Test');
				expect(client.description).to.equal('Test service account');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
			});

			it('should find a service account by client id', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				const { client } = await sdk.client.find(account, 100, 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.name).to.equal('Test');
				expect(client.description).to.equal('Test service account');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
			});

			it('should fail to find non-existent service account', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.find(account, 100, 'does_not_exist')).to.eventually.be.rejectedWith(Error, 'Service account "does_not_exist" not found');
			});
		});

		describe('generateKeyPair()', () => {
			it('should generate a key pair', async () => {
				const { sdk } = await createSdkSync();
				const certs = await sdk.client.generateKeyPair();
				expect(certs.publicKey).to.include('-----BEGIN PUBLIC KEY-----');
				expect(certs.privateKey).to.include('-----BEGIN PRIVATE KEY-----');
			});
		});

		describe('list()', () => {

			it('should return clients for an org', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				const { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(2);
			});
		});

		describe('remove()', () => {

			it('should error removing a service account if client id is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.remove(account, 100, {})).to.eventually.be.rejectedWith(TypeError, 'Expected client to be an object or client id');
			});

			it('should error removing a service account if not found', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.remove(account, 100, 'does_not_exist')).to.eventually.be.rejectedWith(Error, 'Service account "does_not_exist" not found');
			});

			it('should remove a service account by name', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				let { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(2);

				const { client } = await sdk.client.remove(account, 100, 'Test');
				expect(client.name).to.equal('Test');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');

				({ clients } = await sdk.client.list(account, 100));
				expect(clients).to.have.lengthOf(1);
			});

			it('should remove a service account by client id', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				let { clients } = await sdk.client.list(account, 100);
				expect(clients).to.have.lengthOf(2);

				const { client } = await sdk.client.remove(account, 100, 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');
				expect(client.name).to.equal('Test');
				expect(client.client_id).to.equal('test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad');

				({ clients } = await sdk.client.list(account, 100));
				expect(clients).to.have.lengthOf(1);
			});
		});

		describe('update()', () => {

			it('should error updating a service account if options are invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.update(account, 100, 'foo')).to.eventually.be.rejectedWith(TypeError, 'Expected options to be an object');
			});

			it('should error updating a service account if client id is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.update(account, 100, { client: {} })).to.eventually.be.rejectedWith(TypeError, 'Expected client to be an object or client id');
			});

			it('should error updating a service account if not found', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);
				await expect(sdk.client.update(account, 100, { client: 'does_not_exist' })).to.eventually.be.rejectedWith(Error, 'Service account "does_not_exist" not found');
			});

			it('should update a service account by name', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					name: []
				})).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
			});

			it('should error if description is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					desc: []
				})).to.eventually.be.rejectedWith(TypeError, 'Expected description to be a string');
			});

			it('should error if public key is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					publicKey: []
				})).to.eventually.be.rejectedWith(TypeError, 'Expected public key to be a string');

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					publicKey: 'foo'
				})).to.eventually.be.rejectedWith(Error, 'Expected public key to be PEM formatted');
			});

			it('should error if secret is invalid', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					secret: []
				})).to.eventually.be.rejectedWith(TypeError, 'Expected secret to be a string');
			});

			it('should error trying to change auth method', async function () {
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.client.update(account, 100, {
					client: 'test_629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
					publicKey: fs.readFileSync(path.join(__dirname, '../../helpers/public_key.pem'), 'utf-8')
				})).to.eventually.be.rejectedWith(Error, 'Service account "Test" uses auth method "Client Secret" and cannot be changed to "Client Certificate"');
			});
		});
	});

	describe('Org', () => {
		describe('list()', () => {

			it('should get all orgs', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const orgs = await sdk.org.list(account);
				expect(orgs).to.have.lengthOf(1);
				console.log(orgs);
				expect(orgs[0].guid).to.equal('1000');
				expect(orgs[0].name).to.equal('Foo org');
				expect(orgs[0].default).to.equal(true);
			});

			it('should error if default org is invalid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.org.list(account, {})).to.eventually.be.rejectedWith(TypeError, 'Expected organization identifier');
				await expect(sdk.org.list(account, 'wiz')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "wiz"');
			});
		});

		describe('find()', () => {

			it('should find an org', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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

			it('should get org environments', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const envs = await sdk.org.environments(account);
				console.log(envs)
				expect(envs).to.deep.equal([
					{
						name: 'production',
						isProduction: true
					},
					{
						name: 'development',
						isProduction: false
					},
					{
						name: 'Foo',
						isProduction: true,
						guid: '2222222222'
					},
					{
						name: 'Bar',
						isProduction: false,
						guid: '3333333333'
					},
					{
						name: 'Baz',
						isProduction: true,
						guid: '4444444444'
					},
					{
						name: 'Pow',
						isProduction: true,
						guid: '5555555555'
					}
				]);
			});
		});

		describe('rename()', () => {

			it('should get rename an org', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const org = await sdk.org.rename(account, 100, 'Wiz org');
				expect(org.name).to.equal('Wiz org');
			});

			it('should error if new name is invalid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.org.rename(account, 100)).to.eventually.be.rejectedWith(TypeError, 'Organization name must be a non-empty string');
				await expect(sdk.org.rename(account, 100, 123)).to.eventually.be.rejectedWith(TypeError, 'Organization name must be a non-empty string');
				await expect(sdk.org.rename(account, 100, '')).to.eventually.be.rejectedWith(TypeError, 'Organization name must be a non-empty string');
			});
		});

		describe('activity()', () => {

			it('should get org activity with default date range', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const activity = await sdk.org.activity(account);
				expect(activity.events).to.have.lengthOf(0);
			});

			it('should org activity with date range', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.org.activity(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error getting org activity if dates are invalid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.org.activity(account, 100, { from: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "from" date to be in the format YYYY-MM-DD');
				await expect(sdk.org.activity(account, 100, { to: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "to" date to be in the format YYYY-MM-D');
			});
		});

		describe('usage()', () => {

			it('should get org usage with default date range', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const { usage } = await sdk.org.usage(account);
				expect(usage.SaaS).to.deep.equal({
					apiRateMonth: { name: 'API Calls', quota: 5000, value: 0, unit: 'Calls' },
					pushRateMonth: { name: 'Push Notifications', quota: 2000, value: 0, unit: 'Calls' },
					storageFilesGB: { name: 'File Storage', quota: 100, value: 0, unit: 'GB' },
					storageDatabaseGB: { name: 'Database Storage', quota: 100, value: 0, unit: 'GB' },
					containerPoints: { name: 'Container Points', quota: 1000, value: 0, unit: 'Points' },
					eventRateMonth: { name: 'Analytics Events', quota: 10000000, value: 0, unit: 'Events' }
				});
			});

			it('should org usage with date range', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				let { usage } = await sdk.org.usage(account, 100, {
					from: '2021-02-04',
					to: '2021-02-10'
				});
				expect(usage.SaaS).to.deep.equal({
					apiRateMonth: {
						name: 'API Calls',
						percent: 15,
						quota: 5000,
						value: 784,
						unit: 'Calls'
					},
					pushRateMonth: {
						name: 'Push Notifications',
						percent: 8,
						quota: 2000,
						value: 167,
						unit: 'Calls'
					},
					storageFilesGB: {
						name: 'File Storage',
						quota: 100,
						value: 0,
						unit: 'GB'
					},
					storageDatabaseGB: {
						name: 'Database Storage',
						percent: 0,
						quota: 100,
						value: 0.14 + 0.07,
						unit: 'GB'
					},
					containerPoints: {
						name: 'Container Points',
						percent: 90,
						quota: 1000,
						value: 906,
						unit: 'Points'
					},
					eventRateMonth: {
						name: 'Analytics Events',
						percent: 1,
						quota: 10000000,
						value: 190666,
						unit: 'Events'
					}
				});

				({ usage } = await sdk.org.usage(account, 100, {
					from: '2021-02-01',
					to: '2021-02-20'
				}));
				expect(usage.SaaS).to.deep.equal({
					apiRateMonth: {
						name: 'API Calls',
						percent: 25,
						quota: 5000,
						value: 1294,
						unit: 'Calls'
					},
					pushRateMonth: {
						name: 'Push Notifications',
						percent: 60,
						quota: 2000,
						value: 1211,
						unit: 'Calls'
					},
					storageFilesGB: {
						name: 'File Storage',
						percent: 0,
						quota: 100,
						value: 0.0013,
						unit: 'GB'
					},
					storageDatabaseGB: {
						name: 'Database Storage',
						percent: 0,
						quota: 100,
						value: 0.14 + 0.07 + 0.11,
						unit: 'GB'
					},
					containerPoints: {
						name: 'Container Points',
						percent: 226,
						quota: 1000,
						value: 2266,
						unit: 'Points'
					},
					eventRateMonth: {
						name: 'Analytics Events',
						percent: 4,
						quota: 10000000,
						value: 423110,
						unit: 'Events'
					}
				});
			});

			it('should error getting org usage for non-existing org', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.org.usage(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error getting org usage if dates are invalid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.org.usage(account, 100, { from: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "from" date to be in the format YYYY-MM-DD');
				await expect(sdk.org.usage(account, 100, { to: 'foo' })).to.eventually.be.rejectedWith(Error, 'Expected "to" date to be in the format YYYY-MM-D');
			});
		});

		describe('users', () => {
			describe('list()', () => {

				it('should list all users in an org', async function () {
					this.timeout(10000);
					let { auth, account, sdk, tokenStore } = await createSdkSync(true);

					let { users } = await sdk.org.user.list(account);
					expect(users).to.deep.equal([
						{
							guid: '50000',
							email: 'test1@domain.com',
							firstname: 'Test1',
							lastname: 'Tester1',
							name: 'Test1 Tester1',
							roles: ['administrator'],
							teams: 3,
							primary: true
						},
						{
							guid: '50001',
							email: 'test2@domain.com',
							firstname: 'Test2',
							lastname: 'Tester2',
							name: 'Test2 Tester2',
							roles: ['developer'],
							teams: 0
						}
					]);

					// Reauthenticate as the cert user which is a member of the other test org
					({ auth, account, sdk, tokenStore } = await createSdkSync({
						clientId: 'test-auth-client-cert',
						secretFile: secretFilePath
					}));

					({ users } = await sdk.org.user.list(account, '2000'));
					expect(users).to.deep.equal([
						{
							guid: '50000',
							email: 'test1@domain.com',
							firstname: 'Test1',
							lastname: 'Tester1',
							name: 'Test1 Tester1',
							roles: ['administrator'],
							primary: true,
							teams: 3
						}
					]);
				});

				it('should error getting users for non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.list(account, 300)).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});
			});

			describe('find()', () => {

				it('should find an org user by guid', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const user = await sdk.org.user.find(account, 100, '50000');
					expect(user).to.deep.equal({
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						roles: ['administrator'],
						primary: true,
						teams: 3
					});
				});

				it('should find an org user by email', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const user = await sdk.org.user.find(account, 100, 'test2@domain.com');
					expect(user).to.deep.equal({
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						roles: ['developer'],
						teams: 0
					});
				});

				it('should error finding an non-existing org user', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const user = await sdk.org.user.find(account, 100, '12345');
					expect(user).to.be.undefined;
				});
			});

			describe('add()', () => {

				it('should add a user to an org by email', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					expect(await sdk.org.user.find(account, 100, 'test3@domain.com')).to.be.undefined;

					const { user } = await sdk.org.user.add(account, 100, 'test3@domain.com', ['developer']);
					expect(user.guid).to.deep.equal('50002');

					expect(await sdk.org.user.find(account, 100, 'test3@domain.com')).to.deep.equal({
						guid: '50002',
						email: 'test3@domain.com',
						firstname: 'Test3',
						lastname: 'Tester3',
						name: 'Test3 Tester3',
						roles: ['developer'],
						teams: 0
					});

					await expect(sdk.org.user.add(account, 100, 'test3@domain.com', ['developer'])).to.eventually.be
						.rejectedWith(Error, 'Failed to add user to organization: User is already a member of this org. (400)');
				});

				it('should error adding add a user to a non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.add(account, 300)).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.add(account, 100, '12345')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.user.add(account, 100, '12345', 'foo')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.user.add(account, 100, '12345', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.org.user.add(account, 100, '12345', ['foo'])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer, some_admin');
				});

				it('should error if roles does not include a default role', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.add(account, 100, '12345', ['some_admin'])).to.eventually.be.rejectedWith(Error, 'You must specify a default role: administrator, developer');
				});
			});

			describe('update()', () => {

				it('should update an org user\'s role', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const { user } = await sdk.org.user.update(account, 100, '50001', ['administrator']);
					expect(user).to.deep.equal({
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						roles: ['administrator'],
						teams: 0
					});
				});

				it('should error updating user role for non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.update(account, 300, '50001', ['administrator'])).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});

				it('should error update user role for user not in an org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.update(account, 100, '50002', ['administrator'])).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.update(account, 100, '50001')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.user.update(account, 100, '50001', 'foo')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.org.user.update(account, 100, '50001', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.org.user.update(account, 100, '50001', ['foo'])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer, some_admin');
				});
			});

			describe('remove()', () => {

				it('should remove a user from an org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					expect((await sdk.org.user.list(account, 100)).users).to.have.lengthOf(2);
					await sdk.org.user.remove(account, 100, '50001');
					expect((await sdk.org.user.list(account, 100)).users).to.have.lengthOf(1);
				});

				it('should error removing a user from a non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.remove(account, 300, '50001')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "300"');
				});

				it('should error removing a user that does not currently belong to an org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.org.user.remove(account, 100, '50002')).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});
			});
		});
	});

	describe('Role', () => {

		it('should get roles for an org', async function () {
			this.timeout(10000);
			const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
			const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
			const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
			const { auth, account, sdk, tokenStore } = await createSdkSync(true);
			await expect(sdk.role.list({})).to.eventually.be.rejectedWith(Error, 'Failed to get roles');
		});
	});

	describe('Team', () => {
		describe('list()', () => {

			it('should list all teams for an org', async function () {
				this.timeout(10000);
				let { auth, account, sdk, tokenStore } = await createSdkSync(true);

				let { teams } = await sdk.team.list(account, 100);
				expect(teams).to.have.lengthOf(1);
				expect(teams[0].name).to.equal('A Team');

				// Reauthenticate as the cert user which is a member of the other test org
				({ auth, account, sdk, tokenStore } = await createSdkSync({
					clientId: 'test-auth-client-cert',
					secretFile: secretFilePath
				}));
				({ teams } = await sdk.team.list(account, 200));
				expect(teams).to.have.lengthOf(2);
				expect(teams[0].name).to.equal('B Team');
				expect(teams[1].name).to.equal('B Team');
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.list(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});
		});

		describe('find()', () => {

			it('should find a team by guid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const { team } = await sdk.team.find(account, '1000', '60000');
				expect(team.name).to.equal('A Team');
			});

			it('should find a team by name', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				let { team } = await sdk.team.find(account, '1000', 'A Team');
				expect(team.name).to.equal('A Team');

				({ team } = await sdk.team.find(account, '1000', 'a team'));
				expect(team.name).to.equal('A Team');

				({ team } = await sdk.team.find(account, '1000', 'A TEAM'));
				expect(team.name).to.equal('A Team');
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.find(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team is invalid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.find(account, 100)).to.eventually.be.rejectedWith(TypeError, 'Expected team to be a name or guid');
				await expect(sdk.team.find(account, 100, 123)).to.eventually.be.rejectedWith(TypeError, 'Expected team to be a name or guid');
			});

			it('should error if team not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.find(account, 100, 'foo')).to.eventually.be.rejectedWith(Error, 'Unable to find team "foo" in the "Foo org" organization');
			});
		});

		describe('create()', () => {

			it('should create a new team', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.create(account, 100)).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
				await expect(sdk.team.create(account, 100, 123)).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
				await expect(sdk.team.create(account, 100, '')).to.eventually.be.rejectedWith(TypeError, 'Expected name to be a non-empty string');
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.create(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team info is invalid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.create(account, 100, 'C Team', 'foo')).to.eventually.be.rejectedWith(TypeError, 'Expected team info to be an object');
				await expect(sdk.team.create(account, 100, 'C Team', { tags: 'foo' })).to.eventually.be.rejectedWith(TypeError, 'Expected team tags to be an array of strings');
			});
		});

		describe('update()', () => {

			it('should update a team\'s info', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
					tags: ['abc', 'def']
				});

				({ team } = await sdk.team.find(account, 100, team.guid));
				expect(team.name).to.equal('D Team');
				expect(team.desc).to.equal('The D Team');
				expect(team.guid).to.equal('60000');
				expect(team.default).to.equal(false);
				expect(team.tags).to.deep.equal(['abc', 'def']);
			});

			it('should not error if no info to update', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				const { team } = await sdk.team.update(account, 100, 'A Team');
				expect(team.name).to.equal('A Team');
				expect(team.desc).to.equal(undefined);
				expect(team.guid).to.equal('60000');
				expect(team.default).to.equal(true);
				expect(team.tags).to.deep.equal([]);
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.update(account, 'abc', 'A Team')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team is not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.update(account, 100, 'C Team')).to.eventually.be.rejectedWith(Error, 'Unable to find team "C Team" in the "Foo org" organization');
			});
		});

		describe('remove()', () => {

			it('should remove a team', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				let { teams } = await sdk.team.list(account, 100);
				expect(teams).to.have.lengthOf(1);

				await sdk.team.remove(account, 100, 'A Team');

				({ teams } = await sdk.team.list(account, 100));
				expect(teams).to.have.lengthOf(0);
			});

			it('should error if org is not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.remove(account, 'abc', 'A Team')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
			});

			it('should error if team is not found', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.team.remove(account, 100, 'C Team')).to.eventually.be.rejectedWith(Error, 'Unable to find team "C Team" in the "Foo org" organization');
			});
		});

		describe('users', () => {
			describe('list()', () => {

				it('should list all users in a team', async function () {
					this.timeout(10000);
					let { auth, account, sdk, tokenStore } = await createSdkSync(true);

					let { users } = await sdk.team.user.list(account, 100, '60000');
					expect(users).to.have.lengthOf(2);

					// Reauthenticate as the cert user which is a member of the other test org
					({ auth, account, sdk, tokenStore } = await createSdkSync({
						clientId: 'test-auth-client-cert',
						secretFile: secretFilePath
					}));

					({ users } = await sdk.team.user.list(account, 200, '60001'));
					expect(users).to.have.lengthOf(1);
				});

				it('should error getting users for non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.list(account, 'abc', '60000')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error getting users if team is not found', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.list(account, 100, 'Z Team')).to.eventually.be.rejectedWith(Error, 'Unable to find team "Z Team" in the "Foo org" organization');
				});
			});

			describe('find()', () => {

				it('should find a team user by guid', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const { user } = await sdk.team.user.find(account, 100, '60000', '50000');
					expect(user).to.deep.equal({
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						roles: ['administrator'],
						primary: true,
						teams: 3,
						type: 'user'
					});
				});

				it('should find a team user by email', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const { user } = await sdk.team.user.find(account, 100, '60000', 'test1@domain.com');
					expect(user).to.deep.equal({
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						roles: ['administrator'],
						primary: true,
						teams: 3,
						type: 'user'
					});
				});

				it('should error finding an non-existing team user', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const { user } = await sdk.team.user.find(account, 100, '60000', '12345');
					expect(user).to.be.undefined;
				});
			});

			describe('add()', () => {

				it('should add a user to a team by email', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					expect((await sdk.team.user.find(account, 100, '60000', 'test2@domain.com')).user).to.be.undefined;

					const { user } = await sdk.team.user.add(account, 100, '60000', 'test2@domain.com', ['developer']);
					expect(user.guid).to.deep.equal('50001');

					expect((await sdk.team.user.find(account, 100, '60000', 'test2@domain.com')).user).to.deep.equal({
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						roles: ['developer'],
						type: 'user',
						teams: 1
					});

					await expect(sdk.team.user.add(account, 100, '60000', 'test2@domain.com', ['developer'])).to.eventually.be
						.rejectedWith(Error, 'Failed to add user to organization: User is already a member of this team. (400)');
				});

				it('should add a user to a team by user guid', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					expect((await sdk.team.user.find(account, 100, '60000', '50001')).user).to.be.undefined;

					const { user } = await sdk.team.user.add(account, 100, '60000', '50001', ['developer']);
					expect(user.guid).to.deep.equal('50001');

					expect((await sdk.team.user.find(account, 100, '60000', '50001')).user).to.deep.equal({
						guid: '50001',
						email: 'test2@domain.com',
						firstname: 'Test2',
						lastname: 'Tester2',
						name: 'Test2 Tester2',
						roles: ['developer'],
						type: 'user',
						teams: 1
					});

					await expect(sdk.team.user.add(account, 100, '60000', '50001', ['developer'])).to.eventually.be
						.rejectedWith(Error, 'Failed to add user to organization: User is already a member of this team. (400)');
				});

				it('should error adding add a user to a team for a non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.add(account, 'abc')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.add(account, 100, '60000', '50001')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.user.add(account, 100, '60000', '50001', 'foo')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.user.add(account, 100, '60000', '50001', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.team.user.add(account, 100, '60000', '50001', ['foo'])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer');
				});
			});

			describe('update()', () => {

				it('should update a team user\'s role', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					const { user } = await sdk.team.user.update(account, 100, '60000', '50000', ['developer']);
					expect(user).to.deep.equal({
						guid: '50000',
						email: 'test1@domain.com',
						firstname: 'Test1',
						lastname: 'Tester1',
						name: 'Test1 Tester1',
						roles: ['developer'],
						primary: true,
						teams: 3,
						type: 'user'
					});
				});

				it('should error updating user role for non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.update(account, 'abc', '60000', '50001', ['administrator'])).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error update user\'s team role for user not in an org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.update(account, 100, '60000', '50002', ['administrator'])).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});

				it('should error if roles are invalid', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.update(account, 100, '60000', '50000')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.user.update(account, 100, '60000', '50000', 'foo')).to.eventually.be.rejectedWith(TypeError, 'Expected roles to be an array');
					await expect(sdk.team.user.update(account, 100, '60000', '50000', [])).to.eventually.be.rejectedWith(Error, 'Expected at least one of the following roles:');
					await expect(sdk.team.user.update(account, 100, '60000', '50000', ['foo'])).to.eventually.be.rejectedWith(Error, 'Invalid role "foo", expected one of the following: administrator, developer');
				});

				it('should error if user not a member of the team', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.update(account, 100, '60000', '50002', ['developer'])).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});

				it('should error updating user if team is not found', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.update(account, 100, 'Z Team', '50000', ['developer'])).to.eventually.be.rejectedWith(Error, 'Unable to find team "Z Team" in the "Foo org" organization');
				});
			});

			describe('remove()', () => {

				it('should remove a user from a team', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					expect((await sdk.team.user.list(account, 100, '60000')).users).to.have.lengthOf(2);
					await sdk.team.user.remove(account, 100, '60000', '50000');
					expect((await sdk.team.user.list(account, 100, '60000')).users).to.have.lengthOf(1);
				});

				it('should error removing a user from a non-existing org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.remove(account, 'abc', '60000', '50001')).to.eventually.be.rejectedWith(Error, 'Unable to find the organization "abc"');
				});

				it('should error removing a user that does not currently belong to an org', async function () {
					this.timeout(10000);
					const { auth, account, sdk, tokenStore } = await createSdkSync(true);

					await expect(sdk.team.user.remove(account, 100, '60000', '50002')).to.eventually.be.rejectedWith(Error, 'Unable to find the user "50002"');
				});
			});
		});
	});

	describe('User', () => {
		describe('find()', () => {

			it('should find a user by guid', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

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
				const { auth, account, sdk, tokenStore } = await createSdkSync(true);

				await expect(sdk.user.find(account, 'foo@bar.com')).to.eventually.be.rejectedWith(Error, 'User "foo@bar.com" not found');
				await expect(sdk.user.find(account, '12345')).to.eventually.be.rejectedWith(Error, 'User "12345" not found');
			});
		});

		describe('update()', () => {

			it('should return an error on use', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync();
				await expect(sdk.user.update()).to.eventually.be.rejectedWith(Error, 'Platform user records can no longer be updated via the SDK.');
			});
		});

		describe('activity()', () => {

			it('should return an error on use', async function () {
				this.timeout(10000);
				const { auth, account, sdk, tokenStore } = await createSdkSync();
				await expect(sdk.user.activity()).to.eventually.be.rejectedWith(Error, 'Platform user activity can no longer be requested via the SDK.');
			});
		});
	});

	describe('resolveMonthRange', () => {
		it('should error if month is invalid', () => {
			expect(() => {
				resolveMonthRange();
			}).to.throw(TypeError, 'Expected month to be in the format YYYY-MM or MM');

			expect(() => {
				resolveMonthRange({});
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
