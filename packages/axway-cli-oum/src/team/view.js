export default {
	aliases: [ '!info' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
		{
			name: 'team',
			desc: 'The team GUID',
			required: true
		}
	],
	desc: 'View organization team details',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const team = await sdk.team.find(account, org, argv.team);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				team
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		console.log(`Name:         ${highlight(team.name)}`);
		console.log(`Description:  ${team.desc ? highlight(team.desc) : note('n/a')}`);
		console.log(`Org GUID:     ${highlight(team.guid)}`);
		console.log(`Date Created: ${highlight(new Date(team.created).toLocaleString())}`);
		console.log(`Is Default:   ${highlight(team.default ? 'Yes' : 'No')}`);
		console.log(`Members:      ${highlight(team.users.length)}`);
		console.log(`Apps:         ${highlight(team.apps.length)}`);
		console.log(`Tags:         ${team.tags.length ? highlight(team.tags.map(s => `"${s}"`).join(', ')) : note('n/a')}`);
	}
};
