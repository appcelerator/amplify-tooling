export default {
	aliases: [ 'rm' ],
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		},
		{
			name: 'user',
			desc: 'The user guid or email address',
			required: true
		}
	],
	desc: 'Remove a member from a team',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Remove team member');
	}
};
