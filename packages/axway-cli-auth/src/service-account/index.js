export default {
	commands: [
		`${__dirname}/add-team.js`,
		`${__dirname}/create.js`,
		`${__dirname}/generate-keypair.js`,
		`${__dirname}/list.js`,
		`${__dirname}/remove.js`,
		`${__dirname}/remove-team.js`,
		`${__dirname}/roles.js`,
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

  List all service accounts:
    ${style.highlight('axway service-account list')}

  Create a service account with interactive prompting:
    ${style.highlight('axway service-account create')}

  Create a service account with minimum non-interactive arguments:
    ${style.highlight('axway service-account create --name foo --secret bar')}

  Change a service account name, description, and role:
    ${style.highlight('axway service-account update <name/client-id> --name <new_name> --desc <desc> --role <role>')}

  Add a team to an existing service account:
    ${style.highlight('axway service-account add-team <client-id/name> <team_guid> <team_role>')}

  Remove a team from a service account:
    ${style.highlight('axway service-account remove-team <client-id/name> <team_guid>')}

  Remove a service account:
    ${style.highlight('axway service-account remove <client-id/name>')}

  View available team roles:
    ${style.highlight('axway service-account roles')}`;
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
