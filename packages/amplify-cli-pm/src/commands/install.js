export default {
	aliases: [ 'i' ],
	desc: 'installs the specified package',
	options: {
		'--auth <account>': {
			desc: 'the authorization account to use'
		}
	},
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to install',
			required: true
		}
	],
	async action({ argv }) {
		//
	}
};
