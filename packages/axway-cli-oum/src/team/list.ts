import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

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
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the list of teams as JSON'
		}
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);
		const { teams } = await sdk.team.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				org,
				teams
			}, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { green, highlight, note } = snooplogg.styles;

		console.log(`Account:      ${highlight(account.name)}`);
		console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

		if (!teams.length) {
			console.log('No teams found');
			return;
		}

		const { createTable } = await import('@axway/amplify-cli-utils');
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
