export default {
	aliases: [ '!info' ],
	desc: 'View your user information',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('User info');
	}
};
