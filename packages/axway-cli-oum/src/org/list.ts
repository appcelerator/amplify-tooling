import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';

export default {
	aliases: [ 'ls' ],
	desc: 'List organizations',
	options: {
		'--account [name]': 'The account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the organizations as JSON'
		}
	},
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { createTable, initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account as string, undefined, argv.env as string);
		const orgs = await sdk.org.list(account, org);

		if (argv.json) {
			console.log(JSON.stringify({
				account: account.name,
				orgs
			}, null, 2));
			return;
		}

		const { default: snooplogg } = await import('snooplogg');
		const { green, highlight } = snooplogg.styles;
		console.log(`Account: ${highlight(account.name)}\n`);

		if (!orgs.length) {
			console.log('No organizations found');
			return;
		}

		const table = createTable([ 'Organization', 'GUID', 'ORG ID' ]);
		const check = process.platform === 'win32' ? '√' : '✔';

		for (const { default: def, guid, org_id, name } of orgs) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				guid,
				org_id
			]);
		}
		console.log(table.toString());
	}
};
