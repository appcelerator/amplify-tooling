export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'List organization teams',
	options: {
		'--account [name]': 'The account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the list of teams as JSON'
		}
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);
		const { teams } = await sdk.team.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				teams
			}, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { green, highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!teams.length) {
			console.log('No teams found');
			return;
		}

		const { createTable } = require('@axway/amplify-cli-utils');
		const table = createTable([ 'Name', 'Description', 'GUID', 'User', 'Apps', 'Date Created' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { apps, created, default: def, desc, guid, name, users } of teams) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				desc || note('n/a'),
				guid,
				users.length,
				apps.length,
				new Date(created).toLocaleDateString()
			]);
		}
		console.log(table.toString());
	}
};
