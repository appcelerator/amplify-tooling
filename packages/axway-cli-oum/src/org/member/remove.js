export default {
	aliases: [ 'rm' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org',
			required: true
		},
		{
			name: 'user',
			desc: 'The user guid or email address',
			required: true
		}
	],
	desc: 'Remove a member from an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Remove org member');
	}
};
