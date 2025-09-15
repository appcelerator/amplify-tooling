import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
	commands: [
		`${__dirname}/service-account/add-team.js`,
		`${__dirname}/service-account/create.js`,
		`${__dirname}/service-account/generate-keypair.js`,
		`${__dirname}/service-account/list.js`,
		`${__dirname}/service-account/remove.js`,
		`${__dirname}/service-account/remove-team.js`,
		`${__dirname}/service-account/roles.js`,
		`${__dirname}/service-account/update.js`,
		`${__dirname}/service-account/view.js`
	],
	desc: 'Create and manage service accounts',
	help: {
		header({ style }) {
			return `Create and manage service accounts, generate public/private keypairs, and
assign teams.

When authenticating using a service account in a headless environment, such as
a SSH terminal, you must set the token store type to "file":

  ${style.highlight('axway config set auth.tokenStoreType file')}`;
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
	name: 'service-account',
	options: {
		'--base-url [url]': { hidden: true, redact: false },
		'--realm [realm]':  { hidden: true, redact: false }
	}
};
