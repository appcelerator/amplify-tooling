export default {
	desc: 'Display your activity',
	options: {
		'--account [name]': 'The platform account to use',
		'--from [yyyy-mm-dd]': 'The start date',
		'--json': 'Outputs accounts as JSON',
		'--to [yyyy-mm-dd]': 'The end date'
	},
	async action({ argv, console }) {
		console.log('Displaying user activity');
	}
};
