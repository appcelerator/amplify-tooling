export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		}
	],
	desc: 'List all members in a team',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('List team members');
	}
};
