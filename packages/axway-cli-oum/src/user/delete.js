export default {
	aliases: [ 'rm' ],
	desc: 'Deletes users',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Hi from user delete!');
	}
};
