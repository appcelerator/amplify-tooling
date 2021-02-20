export default {
	aliases: [ 'ls' ],
	desc: 'Lists organizations',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Hi from org list!');
	}
};
