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
		'--default':        'Set the team as the default team',
		'--desc [value]':   'The description of the team',
		'--json':           'Outputs accounts as JSON',
		'--tag [tag]': {
			aliases: '--tags',
			desc: 'One or more tags to assign to this team',
			multiple: true
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../lib/util');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		const { team } = await sdk.team.create(account, org, argv.name, {
			desc:    argv.desc,
			default: argv.default,
			tags:    argv.tag
		});
		const results = {
			account: account.name,
			org,
			team
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			console.log(`Successfully created team ${highlight(team.name)} ${note(`(${team.guid})`)}`);
		}

		await cli.emitAction('axway:oum:team:add', results);
	}
};
