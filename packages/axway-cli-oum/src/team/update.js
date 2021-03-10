export default {
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		}
	],
	desc: 'Update the team information',
	options: {
		'--account [name]': 'The platform account to use',
		'--desc [value]': 'The description of the team',
		'--json': 'Outputs accounts as JSON',
		'--name [value]': 'The team name'
	},
	async action({ argv, console }) {
		console.log('Update team info');
	}
};
