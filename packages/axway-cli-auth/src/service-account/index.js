import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
		header({ style }) {
			return `Create and manage service accounts, generate public/private keypairs, and
assign teams.

You must be authenticated into a platform account to use the "service-account"
command. If your platform account is not the default account, you need to pass
in the --account argument or set your platform account as the default for your
session using the "axway auth switch" command.

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
	name: 'axway-cli-auth',
	options: {
		'--base-url [url]': { hidden: true, redact: false },
		'--realm [realm]':  { hidden: true, redact: false }
	}
};
