export default {
	aliases: [ 'rm' ],
	desc: 'Deletes organizations',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Hi from org delete!');
	}
};
