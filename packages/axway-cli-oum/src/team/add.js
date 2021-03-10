export default {
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid',
			required: true
		},
		{
			name: 'name',
			desc: 'The name of the team',
			required: true
		}
	],
	desc: 'View organization team details',
	options: {
		'--account [name]': 'The platform account to use',
		'--desc [value]': 'The description of the team',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Add team to org');
	}
};
