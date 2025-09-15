import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
	commands: [
		`${__dirname}/org/activity.js`,
		`${__dirname}/org/idp.js`,
		`${__dirname}/org/list.js`,
		`${__dirname}/org/rename.js`,
		`${__dirname}/org/usage.js`,
		`${__dirname}/org/user.js`,
		`${__dirname}/org/view.js`
	],
	desc: 'Manage Amplify Platform organizations',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('General Organization Examples:')}

  You must be authenticated to view or manage organizations.
  Run ${style.highlight('"axway auth login"')} to authenticate.

  You may specify an organization by name, id, or guid.

  List organizations:
    ${style.highlight('axway org list')}

  View your currently selected organization's details:
    ${style.highlight('axway org view')}

  View a specific organization's details:
    ${style.highlight('axway org view <org>')}

  Rename an organization:
    ${style.highlight('axway org rename <org> <new name>')}

  View activity report for a specific organization:
    ${style.highlight('axway org activity <org>')}

  View usage report for a specific organization:
    ${style.highlight('axway org usage <org>')}

  Output link to platform URL to view or change identity provider (idp) settings:
    ${style.highlight('axway org idp <org>')}

${style.heading('Organization User Management Examples:')}

  List users in your currently selected organization:
    ${style.highlight('axway org user list')}

  List users for a specific organization:
    ${style.highlight('axway org user list <org>')}

  View available user roles:
    ${style.highlight('axway org user roles')}

  Add a user to an organization:
    ${style.highlight('axway org user add <org> <email> --role <role>')}

  Change a user's role within an organization:
    ${style.highlight('axway org user update <org> <user> --role <role>')}

  Remove a user from an organization:
    ${style.highlight('axway org user remove <org> <user>')}`;
		}
	}
};
