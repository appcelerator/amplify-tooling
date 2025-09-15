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
	async action() {
		throw new Error('The "user" commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.');
	}
};
