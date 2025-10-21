import activity from './org/activity.js';
import idp from './org/idp.js';
import list from './org/list.js';
import rename from './org/rename.js';
import usage from './org/usage.js';
import user from './org/user.js';
import view from './org/view.js';
import { heading, highlight } from '../lib/logger.js';

export default {
	commands: {
		activity,
		idp,
		list,
		rename,
		usage,
		user,
		view
  	},
	desc: 'Manage Amplify Platform organizations',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer() {
			return `${heading('General Organization Examples:')}

  You must be authenticated to view or manage organizations.
  Run ${highlight('"axway auth login"')} to authenticate.

  You may specify an organization by name, id, or guid.

  List organizations:
    ${highlight('axway org list')}

  View your currently selected organization's details:
    ${highlight('axway org view')}

  View a specific organization's details:
    ${highlight('axway org view <org>')}

  Rename an organization:
    ${highlight('axway org rename <org> <new name>')}

  View activity report for a specific organization:
    ${highlight('axway org activity <org>')}

  View usage report for a specific organization:
    ${highlight('axway org usage <org>')}

  Output link to platform URL to view or change identity provider (idp) settings:
    ${highlight('axway org idp <org>')}

${heading('Organization User Management Examples:')}

  List users in your currently selected organization:
    ${highlight('axway org user list')}

  List users for a specific organization:
    ${highlight('axway org user list <org>')}

  View available user roles:
    ${highlight('axway org user roles')}

  Add a user to an organization:
    ${highlight('axway org user add <org> <email> --role <role>')}

  Change a user's role within an organization:
    ${highlight('axway org user update <org> <user> --role <role>')}

  Remove a user from an organization:
    ${highlight('axway org user remove <org> <user>')}`;
		}
	}
};
