import path from 'path';
import { CLICommand, CLIHelpOptions } from 'cli-kit';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
	commands: [
		`${__dirname}/activity.js`,
		`${__dirname}/idp.js`,
		`${__dirname}/list.js`,
		`${__dirname}/rename.js`,
		`${__dirname}/usage.js`,
		`${__dirname}/user.js`,
		`${__dirname}/view.js`
	],
	desc: 'Manage Amplify Platform organizations',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		},
		footer({ style }: CLIHelpOptions): string {
			return `${style.heading('General Organization Examples:')}

  You must be authenticated into an Amplify Platform account to view or manage
  organizations. Run ${style.highlight('"axway auth login"')} to authenticate.

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

  Open web browser to view or change identity provider (idp) settings:
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
