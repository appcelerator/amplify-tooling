export default {
	aliases: [ 'ls' ],
	desc: 'Lists users',
	options: {
		'--org [name]': 'The organization to filter by',
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Hi from user list!');
	}
};
