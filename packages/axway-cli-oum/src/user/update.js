export default {
	desc: 'Change your information',
	options: {
		'--first-name [name]': 'Your first name',
		'--json': 'Outputs accounts as JSON',
		'--last-name [name]': 'Your last name'
	},
	async action({ argv, console }) {
		console.log('Update user info');
	}
};
