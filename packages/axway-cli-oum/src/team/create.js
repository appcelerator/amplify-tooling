import { initPlatformAccount } from '@axway/amplify-cli-utils';
import snooplogg from 'snooplogg';

export default {
	aliases: [ '!add', '!new' ],
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
	desc: 'Create a new team for an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--default':        'Set the team as the default team',
		'--desc [value]':   'The description of the team',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--tag [tag]': {
			aliases: '--tags',
			desc: 'One or more tags to assign to the team',
			multiple: true
		}
	},
	async action({ argv, cli, console }) {
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to add a new team to the "${org.name}" organization`);
		}

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
			const { highlight, note } = snooplogg.styles;
			console.log(`Account:      ${highlight(account.name)}`);
			console.log(`Organization: ${highlight(org.name)} ${note(`(${org.guid})`)}\n`);
			console.log(`Successfully created team ${highlight(team.name)} ${note(`(${team.guid})`)}`);
		}

		await cli.emitAction('axway:oum:team:add', results); // legacy 2.x
		await cli.emitAction('axway:oum:team:create', results);
	}
};
