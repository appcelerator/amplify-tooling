export default {
	aliases: [ 'v', 'info', 'show' ],
	desc: 'displays info for a specific package',
	args: [
		{
			name: 'package',
			hint: 'package[@version]',
			desc: 'the package name and version to install',
			required: true
		},
		{
			name: 'filter',
			hint: 'field[.subfield]',
			desc: 'display specific package fields'
		}
	],
	async action({ argv }) {
		//
	}
};
