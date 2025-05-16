import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
	commands: [
		`${__dirname}/create.js`,
		`${__dirname}/list.js`,
		`${__dirname}/remove.js`,
		`${__dirname}/update.js`,
		`${__dirname}/user.js`,
		`${__dirname}/view.js`
	],
	desc: 'Manage Amplify organization teams',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('General Team Examples:')}

  You must be authenticated into an Amplify Platform account to view or manage
  organization teams. Run ${style.highlight('"axway auth login"')} to authenticate.

  You may specify an organization by name, id, or guid as well as the team by
  name or guid.

  List all organization teams:
    ${style.highlight('axway team list <org>')}

  View team details:
    ${style.highlight('axway team view <org> <team>')}

  Create a new team in an organization:
    ${style.highlight('axway team create <org> <team name>')}

  Update team information:
    ${style.highlight('axway team update <org> <team> [options]')}

    Available options:
      ${style.highlight('--default')}          Set the team as the default team.
      ${style.highlight('--desc <text>')}      The description of the team.
      ${style.highlight('--name <new name>')}  The team name.
      ${style.highlight('--tag <value>')}      One or more tags to assign to the team.

  Remove a team:
    ${style.highlight('axway team remove <org> <team>')}

${style.heading('Team User Management Examples:')}

  You may refer to a user by email address or guid.

  List all users in a team:
    ${style.highlight('axway team user list <org>')}

  View available user roles:
    ${style.highlight('axway org user roles')}

  Add a user to a team:
    ${style.highlight('axway team user add <org> <team> <user> --role <role>')}

  Change a user's role within a team:
    ${style.highlight('axway team user update <org> <team> <user> --role <role>')}

  Remove a user from a team:
    ${style.highlight('axway team user remove <org> <team> <user>')}`;
		}
	}
};
