export default {
	aliases: [ 'rm' ],
	args: [
		{
			name: 'team',
			desc: 'The team identifier',
			required: true
		}
	],
	desc: 'Removes a team from an organization',
	options: {
		'--account [name]': 'The platform account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Removing team from org');
	}
};
