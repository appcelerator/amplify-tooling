export default {
	aliases: [ '!info' ],
	desc: 'Display your user information',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs the info as JSON'
		}
	},
	async action({ argv, console }) {
		const { initPlatformAccount } = require('../lib/util');
		const { account } = await initPlatformAccount(argv.account, argv.org);
		const { user } = account;

		if (argv.json) {
			console.log(JSON.stringify(user, null, 2));
			return;
		}

		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;

		console.log(`First Name:   ${highlight(user.firstname)}`);
		console.log(`Last Name:    ${highlight(user.lastname)}`);
		console.log(`Email:        ${highlight(user.email)}`);
		console.log(`Phone Number: ${highlight(user.phone)}`);
		console.log(`Date Joined:  ${highlight(new Date(user.dateJoined).toLocaleDateString())}`);
		console.log(`GUID:         ${highlight(user.guid)}`);
	}
};
