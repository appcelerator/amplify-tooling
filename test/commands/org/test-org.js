import {
	initHomeDir,
	loginCLISync,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync
} from '../../helpers/index.js';

describe('axway org', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'org' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(2);
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'org', '--help' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
			expect(status).to.equal(2);
		});
	});

	describe('activity', () => {
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'org', 'activity' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should display org activity for a specific date range', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync([ 'org', 'activity', '--from', '2021-02-01', '--to', '2021-02-28' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('activity/activity-report'));
			expect(status).to.equal(0);
		});

		it('should display no org activity for specific date range', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync([ 'org', 'activity', '--from', '2021-05-15', '--to', '2021-05-16' ]);
			expect(stdout.toString()).to.match(renderRegexFromFile('activity/no-activity'));
			expect(status).to.equal(0);
		});

		it('should return org activity as JSON', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync([ 'org', 'activity', '--from', '2021-02-01', '--to', '2021-02-28', '--json' ]);
			const result = JSON.parse(stdout);
			expect(result).to.deep.equal({
				account: 'test-auth-client-secret',
				org: {
					active: true,
					guid: '1000',
					id: 100,
					name: 'Foo org',
					entitlements: {
						_a: 10,
						bc: 20
					},
					subscriptions: [],
					teams: [
						{
							name: 'A Team',
							created: '2021-02-14T15:30:00.000Z',
							guid: '60000',
							default: true,
							tags: [],
							org_guid: '1000',
							users: [
								{
									guid: '50000',
									roles: [
										'administrator'
									],
									type: 'user'
								},
								{
									guid: '629e1705-9cd7-4db7-9dfe-08aa47b0f3ad',
									roles: [
										'developer'
									],
									type: 'client'
								}
							]
						}
					],
					teamCount: 1,
					userCount: 2
				},
				from: '2021-02-01T00:00:00.000Z',
				to: '2021-02-28T23:59:59.000Z',
				events: [
					{
						ts: 1612281933000,
						event: 'platform.team.user.add',
						message: 'User __s__test1@domain.com__/s__ added to team __s__Default Team__/s__',
						org_id: 100,
						data: {
							org_name: 'Foo org'
						}
					},
					{
						ts: 1612728620000,
						message: 'Team __s__B Team__/s__ created',
						event: 'platform.team.create',
						org_id: 100,
						data: {
							team: {
								guid: '60001',
								name: 'B Team',
								default: false
							},
							org_name: 'Foo org'
						}
					},
					{
						ts: 1613253008000,
						message: 'Session created for user __s__foo@bar.com__/s__',
						event: 'platform.session.create',
						org_id: 100,
						data: {}
					}
				]
			});
			expect(status).to.equal(0);
		});

		it('should error if dates are invalid', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			let { status, stderr } = await runAxwaySync([ 'org', 'activity', '--from', 'foo' ]);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/bad-from-date'));
			expect(status).to.equal(1);

			({ status, stderr } = await runAxwaySync([ 'org', 'activity', '--to', 'bar' ]));
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/bad-to-date'));
			expect(status).to.equal(1);
		});

		it('should output activity help', async () => {
			const { status, stdout } = await runAxwaySync([ 'org', 'activity', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('activity/help'));
			expect(status).to.equal(2);
		});
	});

	describe('list', () => {
		afterEach(resetHomeDir);

		it('should error if not logged in', async function () {
			initHomeDir('home-local');

			const { status, stderr } = await runAxwaySync([ 'org', 'list' ]);
			expect(stderr).to.match(renderRegexFromFile('list/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if account is not found', async function () {
			initHomeDir('home-local');

			const { status, stderr } = await runAxwaySync([ 'org', 'list', '--account', 'foo' ]);
			expect(stderr).to.match(renderRegexFromFile('list/non-existent-account'));
			expect(status).to.equal(1);
		});

		it('should list the org', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync([ 'org', 'list' ]);
			expect(stdout).to.match(renderRegexFromFile('list/foo-bar'));
			expect(status).to.equal(0);
		});

		it('should list the org as JSON', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync([ 'org', 'list', '--json' ]);
			const result = JSON.parse(stdout);
			expect(result).to.deep.equal({
				account: 'test-auth-client-secret',
				orgs: [
					{
						default: true,
						guid: '1000',
						id: 100,
						name: 'Foo org'
					}
				]
			});
			expect(status).to.equal(0);
		});

		it('should output list help', async () => {
			const { status, stdout } = await runAxwaySync([ 'org', 'list', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('list/help'));
			expect(status).to.equal(2);
		});
	});

	describe('rename', () => {
		//
	});

	describe('usage', () => {
		afterEach(resetHomeDir);

		it('should error if not logged in', async function () {
			initHomeDir('home-local');

			const { status, stderr } = await runAxwaySync([ 'org', 'list' ]);
			expect(stderr).to.match(renderRegexFromFile('list/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org is not found', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stderr } = await runAxwaySync([ 'org', 'usage', '--org', 'does_not_exist' ]);
			expect(stderr).to.match(renderRegexFromFile('usage/bad-org'));
			expect(status).to.equal(1);
		});

		it('should get org usage with bundle and SaaS', async function () {
			initHomeDir('home-local');
			await loginCLISync();

			const { status, stdout } = await runAxwaySync([ 'org', 'usage', '--from', '2021-02-01', '--to', '2021-02-28' ]);
			expect(stdout).to.match(renderRegexFromFile('usage/bundle-saas'));
			expect(status).to.equal(0);
		});

		it('should output usage help', async () => {
			const { status, stdout } = await runAxwaySync([ 'org', 'usage', '--help' ]);
			expect(stdout).to.match(renderRegexFromFile('usage/help'));
			expect(status).to.equal(2);
		});
	});

	describe('user', () => {
		describe('help', () => {
			//
		});

		describe('add', () => {
			//
		});

		describe('list', () => {
			//
		});

		describe('remove', () => {
			//
		});

		describe('roles', () => {
			//
		});

		describe('update', () => {
			//
		});
	});

	describe('view', () => {
		//
	});
});
