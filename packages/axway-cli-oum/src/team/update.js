export default {
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		}
	],
	desc: 'Update the team information',
	options: {
		'--account [name]': 'The platform account to use',
		'--default':        'Set the team as the default team',
		'--desc [value]':   'The description of the team',
		'--json':           'Outputs accounts as JSON',
		'--name [value]':   'The team name',
		'--tag [tag]': {
			aliases: '--tags',
			desc: 'One or more tags to assign to this team',
			multiple: true
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../lib/util');
		let { account, sdk } = await initPlatformAccount(argv.account);

		const { changes, team } = await sdk.team.update(account, argv.team, {
			desc:    argv.desc,
			default: argv.default,
			name:    argv.name,
			tags:    argv.tag
		});
		const results = {
			account: account.name,
			changes,
			team
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight, note } = snooplogg.styles;
			const labels = {
				default: 'is default',
				desc:    'description',
				name:    'name',
				tags:    'tags'
			};
			const format = it => {
				return Array.isArray(it) ? `[${it.map(s => `"${s}"`).join(', ')}]` : `"${it}"`;
			};

			console.log(`Account: ${highlight(account.name)}`);
			console.log(`Team:    ${highlight(team.name)} ${note(`(${team.guid})`)}\n`);

			if (Object.keys(changes).length) {
				for (const [ key, { v, p } ] of Object.entries(changes)) {
					console.log(`Updated ${highlight(labels[key])} from ${highlight(format(p))} to ${highlight(format(v))}`);
				}
			} else {
				console.log('No values were changed');
			}
		}

		await cli.emitAction('axway:oum:team:update', results);
	}
};
