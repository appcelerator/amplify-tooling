export default {
	desc: 'activates a specific package version',
	args: [
		{
			name: 'package[@version]',
			desc: 'the package version or latest to activate',
			required: true
		}
	],
	async action({ argv }) {
		//
	}
};
