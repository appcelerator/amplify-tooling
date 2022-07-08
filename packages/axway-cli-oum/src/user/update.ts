import {
	AxwayCLIOptionCallbackState,
	AxwayCLIState
} from '@axway/amplify-cli-utils';
import { CLICommand, CLIHelpOptions } from 'cli-kit';

export default {
	aliases: [ '!up' ],
	desc: 'Change your information',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		},
		footer({ style }: CLIHelpOptions): string {
			return `${style.heading('Examples:')}

  Update your first and last name:
    ${style.highlight('axway user update --firstname <name> --lastname <name>')}`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--firstname [value]': {
			aliases: '--first-name',
			desc: 'Your first name'
		},
		'--json': {
			callback: ({ ctx, value }: AxwayCLIOptionCallbackState) => ctx.jsonMode = !!value,
			desc: 'Outputs the result as JSON'
		},
		'--lastname [value]': {
			aliases: '--last-name',
			desc: 'Your last name'
		}
	},
	async action({ argv, cli, console, help }: AxwayCLIState): Promise<void> {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account as string, argv.org as string, argv.env as string);

		const { changes, user } = await sdk.user.update(account, {
			firstname: argv.firstname as string,
			lastname:  argv.lastname as string
		});
		const results = {
			account: account.name,
			changes,
			org,
			user
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = await import('snooplogg');
			const { highlight } = snooplogg.styles;
			const labels: {
				[key: string]: string
			} = {
				firstname: 'first name',
				lastname:  'last name'
			};

			if (Object.keys(changes).length) {
				for (const [ key, { v, p } ] of Object.entries(changes)) {
					const from = `"${p === undefined ? '' : p}"`;
					const to = `"${v === undefined ? '' : v}"`;
					console.log(`Updated ${highlight(labels[key])} from ${highlight(from)} to ${highlight(to)}`);
				}
			} else {
				console.log(await help());
			}
		}

		if (Object.keys(changes).length) {
			await cli.emitAction('axway:oum:user:update', results);
		}
	}
};
