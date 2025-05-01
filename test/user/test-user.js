import {
	initHomeDir,
	renderRegexFromFile,
	resetHomeDir,
	runAxwaySync,
	startServers,
	stopServers
} from '../helpers/index.js';

describe('axway user', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = await runAxwaySync([ 'user' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});

		it('should output the help screen using --help flag', async () => {
			const { status, stdout } = await runAxwaySync([ 'user', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('help/help-with-color'));
		});
	});

	describe('activity', () => {
		afterEach(stopServers);
		afterEach(resetHomeDir);

		it('should error if not authenticated', async () => {
			const { status, stderr } = await runAxwaySync([ 'user', 'activity' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/not-authenticated'));
		});

		it('should display user activity for a specific date range', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'user', 'activity', '--from', '2021-02-01', '--to', '2021-02-28' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('activity/activity-report'));
		});

		it('should display no user activity for specific date range', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'user', 'activity', '--from', '2021-05-15', '--to', '2021-05-16' ]);
			expect(status).to.equal(0);
			expect(stdout.toString()).to.match(renderRegexFromFile('activity/no-activity'));
		});

		it('should return user activity as JSON', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			const { status, stdout } = await runAxwaySync([ 'user', 'activity', '--from', '2021-02-01', '--to', '2021-02-28', '--json' ]);
			expect(status).to.equal(0);
			const result = JSON.parse(stdout);
			expect(result).to.deep.equal({
				"account": "test_client:foo@bar.com",
				"from": "2021-02-01T00:00:00.000Z",
				"to": "2021-02-28T23:59:59.000Z",
				"events": [
					{
						"ts": 1612530918676,
						"event": "platform.team.user.remove",
						"message": "User __s__test1@domain.com__/s__ removed from team __s__Default Team__/s__",
						"user_guid": "50000",
						"data": {
							"org_name": "Foo org"
						}
					},
					{
						"ts": 1612574686163,
						"event": "platform.team.user.add",
						"message": "User __s__test1@domain.com__/s__ added to team __s__Default Team__/s__",
						"user_guid": "50000",
						"data": {
							"org_name": "Foo org"
						}
					},
					{
						"ts": 1612906169927,
						"message": "Roles changed for user __s__test1@domain.com__/s__ in organization __s__Foo org__/s__",
						"event": "platform.org.user.role.update",
						"user_guid": "50000",
						"data": {
							"changes": [
								{
									"k": "roles",
									"o": "developer"
								},
								{
									"k": "roles",
									"v": "administrator"
								}
							],
							"org_name": "Foo org"
						}
					},
					{
						"ts": 1613408276641,
						"message": "User updated",
						"event": "platform.user.update",
						"user_guid": "50000",
						"data": {
							"user_guid": "5000",
							"user_email": "test1@domain.com",
							"changes": [
								{
									"k": "firstname",
									"v": "Foo",
									"o": "Bar"
								}
							],
							"org_name": "Foo org"
						}
					}
				]
			});
		});

		it('should error if dates are invalid', async function () {
			initHomeDir('home-local');
			this.servers = await startServers();
			await runAxwaySync([ 'auth', 'login' ], { env: { DISPLAY: 1 } });

			let { status, stdout, stderr } = await runAxwaySync([ 'user', 'activity', '--from', 'foo' ]);
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/bad-from-date'));

			({ status, stderr } = await runAxwaySync([ 'user', 'activity', '--to', 'bar' ]));
			expect(status).to.equal(1);
			expect(stderr.toString()).to.match(renderRegexFromFile('activity/bad-to-date'));
		});

		it('should output activity help', async () => {
			const { status, stdout } = await runAxwaySync([ 'user', 'activity', '--help' ]);
			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegexFromFile('activity/help'));
		});
	});

	describe('credentials', () => {
		//
	});

	describe('update', () => {
		//
	});

	describe('view', () => {
		//
	});
});
