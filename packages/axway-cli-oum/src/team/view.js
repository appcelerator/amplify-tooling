export default {
	aliases: [ '!info' ],
	args: [
		{
			name: 'team',
			desc: 'The team identifier'
		}
	],
	desc: 'View organization team details',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Org team info');
	}
};
