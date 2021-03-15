export default {
	desc: 'Change your information',
	options: {
		'--firstname [value]': {
			aliases: '--first-name',
			desc: 'Your first name'
		},
		'--json': 'Outputs result as JSON',
		'--lastname [value]': {
			aliases: '--last-name',
			desc: 'Your last name'
		},
		'--phone [value]': 'Your phone number'
	},
	async action({ argv, cli, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { account, sdk } = await initPlatformAccount(argv.account, argv.org);
		const info = {};
		const labels = {
			firstname: 'first name',
			lastname: 'last name',
			phone: 'phone number'
		};

		for (const key of [ 'firstname', 'lastname', 'phone' ]) {
			if (argv[key]) {
				info[key] = argv[key].trim();
			}
		}

		if (!Object.keys(info).length) {
			const err = new Error('Please specify a setting to update');
			err.showHelp = true;
			throw err;
		}

		const user = await sdk.user.update(account, info);

		if (argv.json) {
			console.log(JSON.stringify(user, null, 2));
		} else {
			const { default: snooplogg } = require('snooplogg');
			const { highlight } = snooplogg.styles;

			for (const key of Object.keys(info)) {
				console.log(`Updated ${highlight(labels[key])} to ${highlight(`"${user[key]}"`)}`);
			}
		}

		await cli.emitAction('axway:oum:user:update', user);
	}
};
