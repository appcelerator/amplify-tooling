export default {
	aliases: [ 'ls' ],
	args: [
		{
			name: 'org',
			desc: 'The organization name, id, or guid; defaults to the current org'
		}
	],
	desc: 'Lists organization teams',
	options: {
		'--account [name]': 'The account to use',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('List org teams');
	}
};
