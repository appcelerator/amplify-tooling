export default {
	aliases: [ 's', 'se' ],
	desc: 'searches registry for packages',
	options: {
		'--auth <account>': {
			desc: 'the authorization account to use'
		}
	},
	args: [
		{
			name: 'search terms...',
			desc: 'the package name or keywords',
			required: true
		}
	],
	async action({ argv }) {
		//
	}
};
