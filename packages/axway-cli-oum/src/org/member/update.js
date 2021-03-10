export default {
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
	desc: 'Update an member\'s organization roles',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON',
		'--role [role]': {
			desc: 'Assign one or more team roles to a member',
			multiple: true
		}
	},
	async action({ argv, console }) {
		console.log('Update org member (roles)');
	}
};
