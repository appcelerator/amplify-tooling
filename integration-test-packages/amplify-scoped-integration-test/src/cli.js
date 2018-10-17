const { CLI } = require('cli-kit');

const { version } = require('../package.json');

module.exports = new CLI({
	desc: 'A CLI that is used for integration testing the AMPLIFY CLI',
	help: true,
	helpExitCode: 2,
	name: 'amplify-integration-test',
	options: {
		'-f,--force': {
			desc: 'force the action to happen'
		},
		'-m,--my-value <value>': {
			desc: 'an option to pass a value'
		}
	},
	version
})

