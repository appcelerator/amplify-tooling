import {
	AxwayCLIContext,
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { CLICommand } from 'cli-kit';

export default {
	aliases: [ 'rm' ],
	args: [
		{
			desc: 'The service account client id or name',
			hint: 'client-id/name',
			name: 'client-id',
			required: true
		}
	],
	desc: 'Remove a service account',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the result as JSON'
		},
		'--org [name|id|guid]': 'The organization name, id, or guid'
	},
	async action({ argv, cli, console }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(
			argv.account as string,
			argv.org as string,
			argv.env as string
		);

		if (!org.userRoles?.includes('administrator')) {
			throw new Error(`You do not have administrative access to remove a service account in the "${org.name}" organization`);
		}

		const { client } = await sdk.client.remove(account, org, argv.clientId as string);
		const results = {
			account: account.name,
			org,
			client
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = await import('snooplogg');
			const { highlight, note } = snooplogg.styles;

			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);

			const { client_id, name } = results.client;
			console.log(`Successfully removed service account ${highlight(name)} ${note(`(${client_id})`)}`);
		}

		await cli.emitAction('axway:auth:service-account:remove', results);
	}
};
