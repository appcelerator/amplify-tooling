export default {
	desc: 'Creates orgs',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Hi from org add!');
	}
};
