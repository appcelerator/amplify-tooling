export default {
	commands: [
		`${__dirname}/create.js`,
		`${__dirname}/list.js`,
		`${__dirname}/remove.js`,
		`${__dirname}/update.js`,
		`${__dirname}/view.js`
	],
	desc: 'Create and manage service accounts',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  Create a service account:
    ${style.highlight('axway service-account create')}

  List all service accounts:
    ${style.highlight('axway service-account list')}`;
		}
	},
	helpExitCode: 2,
	name: 'axway-cli-auth',
	options: {
		'--base-url [url]': { hidden: true, redact: false },
		'--env [name]':     { hidden: true, redact: false },
		'--realm [realm]':  { hidden: true, redact: false }
	}
};
