export default {
	aliases: [ '!up' ],
	desc: 'Change your information',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  Update your first and last name:
    ${style.highlight('axway user update --firstname <name> --lastname <name>')}

  Update your phone number:
    ${style.highlight('axway user update --phone <number>')}`;
		}
	},
	options: {
		'--account [name]': 'The platform account to use',
		'--firstname [value]': {
			aliases: '--first-name',
			desc: 'Your first name'
		},
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the result as JSON'
		},
		'--lastname [value]': {
			aliases: '--last-name',
			desc: 'Your last name'
		},
		'--phone [value]': 'Your phone number'
	},
	async action({ argv, cli, console, help }) {
		const { initPlatformAccount } = require('@axway/amplify-cli-utils');
		const { account, org, sdk } = await initPlatformAccount(argv.account, argv.org);

		const { changes, user } = await sdk.user.update(account, {
			firstname: argv.firstname,
			lastname:  argv.lastname,
			phone:     argv.phone
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
			const { default: snooplogg } = require('snooplogg');
			const { highlight } = snooplogg.styles;
			const labels = {
				firstname: 'first name',
				lastname:  'last name',
				phone:     'phone number'
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
