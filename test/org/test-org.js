import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers';

describe('axway org', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'org' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'org', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});
	});

	describe('activity', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'org', 'activity' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/not-authenticated'));
		});

		it('should display org activity for a specific date range', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'org', 'activity', '--from', '2021-02-01', '--to', '2021-02-28' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('activity/activity-report'));
		});

		it('should display no org activity for specific date range', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'org', 'activity', '--from', '2021-05-15', '--to', '2021-05-16' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('activity/no-activity'));
		});

		it('should return org activity as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout, stderr } = await runAxwaySync([ 'org', 'activity', '--from', '2021-02-01', '--to', '2021-02-28', '--json' ]);
			expect(status).to.equal(0);
			const result = JSON.parse(stdout);
			expect(result).to.deep.equal({
				"account": "test_client:foo@bar.com",
					"org": {
						"active": true,
						"childOrgs": null,
						"guid": "1000",
						"id": 100,
						"name": "Foo org",
						"entitlements": {
							"_a": 10,
							"bc": 20
						},
						"parentOrg": null,
						"insightUserCount": 0,
						"subscriptions": [],
						"teams": [
							{
								"name": "A Team",
								"guid": "60000",
								"default": true,
								"tags": [],
								"org_guid": "1000",
								"users": [
									{
										"guid": "50000",
										"roles": [
											"administrator"
										]
									}
								]
							}
						],
						"teamCount": 1,
						"userCount": 2,
						"userRoles": [
							"administrator"
						]
					},
					"from": "2021-02-01T00:00:00.000Z",
					"to": "2021-02-28T23:59:59.000Z",
					"events": [
						{
							"ts": 1612281933000,
							"event": "platform.team.user.add",
							"message": "User __s__test1@domain.com__/s__ added to team __s__Default Team__/s__",
							"org_id": 100,
							"data": {
								"org_name": "Foo org"
							}
						},
						{
							"ts": 1612728620000,
							"message": "Team __s__B Team__/s__ created",
							"event": "platform.team.create",
							"org_id": 100,
							"data": {
								"team": {
									"guid": "60001",
									"name": "B Team",
									"default": false
								},
								"org_name": "Foo org"
							}
						},
						{
							"ts": 1613253008000,
							"message": "Session created for user __s__foo@bar.com__/s__",
							"event": "platform.session.create",
							"org_id": 100,
							"data": {}
						}
					]
				});
		});

		it('should error if dates are invalid', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout, stderr } = await runAxwaySync([ 'org', 'activity', '--from', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/bad-from-date'));

			({ status, stderr } = await runAxwaySync([ 'org', 'activity', '--to', 'bar' ]));
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/bad-to-date'));
		});

		it('should output activity help', async () => {
			const { status, stdout } = await runAxwaySync([ 'org', 'activity', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('activity/help'));
		});
	});

	describe('list', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not logged in', async function() {
			initHomeDir('home-local');

			const { status, stderr } = await runAxwaySync([ 'org', 'list' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('list/not-authenticated'));
		});

		it('should error if account is not found', async function() {
			initHomeDir('home-local');

			const { status, stderr } = await runAxwaySync([ 'org', 'list', '--account', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('list/non-existent-account'));
		});

		it('should error if account is not a platform account', async function() {
			initHomeDir('home-local');
			this.servers = await startServers();
			const { name } = JSON.parse((await runAxwaySync([ 'auth', 'login', '--client-secret', 'shhhh', '--json' ])).stdout);

			const { status, stderr } = await runAxwaySync([ 'org', 'list', '--account', name ]);
			expect(status).to.equal(1);
			expect(stderr).to.match(renderRegexFromFile('list/not-platform-account'));
		});

		it('should list all orgs', async function() {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'org', 'list' ]);
			expect(status).to.equal(0);
			expect(stdout).to.match(renderRegexFromFile('list/foo-bar'));
		});

		it('should list all orgs as JSON', async function() {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'org', 'list', '--json' ]);
			expect(status).to.equal(0);
			const result = JSON.parse(stdout);
			expect(result).to.deep.equal({
				"account": "test_client:foo@bar.com",
				"orgs": [
					{
						"default": false,
						"guid": "2000",
						"id": 200,
						"name": "Bar org"
					},
					{
						"default": false,
						"guid": "3000",
						"id": 300,
						"name": "Baz org"
					},
					{
						"default": true,
						"guid": "1000",
						"id": 100,
						"name": "Foo org"
					}
				]
			});
		});

		it('should output list help', async () => {
			const { status, stdout } = await runAxwaySync([ 'org', 'list', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout).to.match(renderRegexFromFile('list/help'));
		});
	});

	describe('rename', () => {
		//
	});

	describe('usage', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not logged in', async function() {
			initHomeDir('home-local');

			const { status, stderr } = await runAxwaySync([ 'org', 'list' ]);
			expect(stderr).to.match(renderRegexFromFile('list/not-authenticated'));
			expect(status).to.equal(1);
		});

		it('should error if org is not found', async function() {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stderr } = await runAxwaySync([ 'org', 'usage', '--org', 'does_not_exist' ]);
			expect(stderr).to.match(renderRegexFromFile('usage/bad-org'));
			expect(status).to.equal(1);
		});

		it('should get org usage with SaaS only', async function() {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'org', 'usage', '--from', '2021-02-01', '--to', '2021-02-28', '--org', '200' ]);
			expect(stdout).to.match(renderRegexFromFile('usage/saas-only'));
			expect(status).to.equal(0);
		});

		it('should get org usage with bundle and SaaS', async function() {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'org', 'usage', '--from', '2021-02-01', '--to', '2021-02-28', '--org', '100' ]);
			expect(stdout).to.match(renderRegexFromFile('usage/bundle-saas'));
			expect(status).to.equal(0);
		});

		it('should get org usage with bundle and unlimited SaaS', async function() {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'org', 'usage', '--from', '2021-02-01', '--to', '2021-02-28', '--org', '300' ]);
			expect(stdout).to.match(renderRegexFromFile('usage/unlimited-saas'));
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
