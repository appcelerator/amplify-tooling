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
	async action() {
		throw new Error('The "user" commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.');
	}
};
