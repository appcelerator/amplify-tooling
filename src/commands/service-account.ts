import addTeam from './service-account/add-team.js';
import create from './service-account/create.js';
import generateKeypair from './service-account/generate-keypair.js';
import list from './service-account/list.js';
import remove from './service-account/remove.js';
import removeTeam from './service-account/remove-team.js';
import roles from './service-account/roles.js';
import update from './service-account/update.js';
import view from './service-account/view.js';

export default {
	commands: {
		'add-team': addTeam,
		create,
		'generate-keypair': generateKeypair,
		list,
		remove,
		'remove-team': removeTeam,
		roles,
		update,
		view
	},
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
		'--realm [realm]': { hidden: true, redact: false }
	}
};
