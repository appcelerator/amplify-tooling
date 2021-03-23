export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
		{
			name: 'name',
			desc: 'The name of the team',
			required: true
		}
	],
	desc: 'Add a team to an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--desc [value]':   'The description of the team',
		'--is-default':     'Set the team as the default team',
		'--json':           'Outputs accounts as JSON',
		'--tag [tag]': {
			desc: '?',
			multiple: true
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../lib/util');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		if (!argv.json) {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
		}

		const team = await sdk.team.create(account, org, argv.name, argv);

		if (argv.json) {
			console.log(JSON.stringify(team, null, 2));
		} else {
			console.log(`Successfully created team "${team.name}" ${note(`(${team.guid})`)}`);
		}

		await cli.emitAction('axway:oum:team:add', {
			account,
			org,
			team
		});
	}
};
