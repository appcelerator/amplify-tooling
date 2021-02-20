export default {
	desc: 'Creates users',
	options: {
		'--json': 'Outputs accounts as JSON'
	},
	async action({ argv, console }) {
		console.log('Hi from user add!');
	}
};
