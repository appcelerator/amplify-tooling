export default {
	aliases: [ '!up' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
		{
			name: 'team',
			desc: 'The team name or guid',
			required: true
		}
	],
	desc: 'Update team information',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Example:')}

  You must be authenticated into an Amplify Platform account to view or manage
  organizations. Run ${style.highlight('"axway auth login"')} to authenticate.

  You may specify an organization by name, id, or guid as well as the team by
  name or guid.

  Rename the team:
    ${style.highlight('axway team update <org> <team> --name <new name>')}

  Update the team description:
    ${style.highlight('axway team update <org> <team> --desc <new description>')}

  Redefine the team tags:
    ${style.highlight('axway team update <org> <team> --tag <tag1> --tag <tag2>')}`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--default':        'Set the team as the default team',
		'--desc [value]':   'The description of the team',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--name [value]':   'The team name',
		'--tag [tag]': {
			aliases: '--tags',
			desc: 'One or more tags to assign to the team',
			multiple: true
		}
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = await import('@axway/amplify-cli-utils');
		let { account, org, sdk } = await initPlatformAccount(argv.account, argv.org, argv.env);

		if (!org.userRoles.includes('administrator')) {
			throw new Error(`You do not have administrative access to update a team in the "${org.name}" organization`);
		}

		const { changes, team } = await sdk.team.update(account, org, argv.team, {
			desc:    argv.desc,
			default: argv.default,
			name:    argv.name,
			tags:    argv.tag
		});
		const results = {
			account: account.name,
			changes,
			org,
			team
		};

		if (argv.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			const { default: snooplogg } = await import('snooplogg');
			const { highlight, note } = snooplogg.styles;
			const labels = {
				default: 'is default',
				desc:    'description',
				name:    'name',
				tags:    'tags'
			};
			const format = it => {
				return Array.isArray(it) ? `[${it.map(s => `"${s === undefined ? '' : s}"`).join(', ')}]` : `"${it === undefined ? '' : it}"`;
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
