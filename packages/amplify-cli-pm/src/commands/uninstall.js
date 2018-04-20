export default {
	desc: 'uninstalls the specified package',
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to uninstall',
			required: true
		}
	],
	async action({ argv }) {
		//
	}
};
