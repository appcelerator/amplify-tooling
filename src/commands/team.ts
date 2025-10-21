import create from './team/create.js';
import list from './team/list.js';
import remove from './team/remove.js';
import update from './team/update.js';
import user from './team/user.js';
import view from './team/view.js';
import { heading, highlight } from '../lib/logger.js';

export default {
	commands: {
		create,
		list,
		remove,
		update,
		user,
		view
  },
	desc: 'Manage Amplify Platform organization teams',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer() {
			return `${heading('General Team Examples:')}

  You must be authenticated to view or manage organization teams.
  Run ${highlight('"axway auth login"')} to authenticate.

  You may specify an organization by name, id, or guid as well as the team by
  name or guid.

  List all organization teams:
    ${highlight('axway team list <org>')}

  View team details:
    ${highlight('axway team view <org> <team>')}

  Create a new team in an organization:
    ${highlight('axway team create <org> <team name>')}

  Update team information:
    ${highlight('axway team update <org> <team> [options]')}

    Available options:
      ${highlight('--default')}          Set the team as the default team.
      ${highlight('--desc <text>')}      The description of the team.
      ${highlight('--name <new name>')}  The team name.
      ${highlight('--tag <value>')}      One or more tags to assign to the team.

  Remove a team:
    ${highlight('axway team remove <org> <team>')}

${heading('Team User Management Examples:')}

  You may refer to a user by email address or guid.

  List all users in a team:
    ${highlight('axway team user list <org>')}

  View available user roles:
    ${highlight('axway org user roles')}

  Add a user to a team:
    ${highlight('axway team user add <org> <team> <user> --role <role>')}

  Change a user's role within a team:
    ${highlight('axway team user update <org> <team> <user> --role <role>')}

  Remove a user from a team:
    ${highlight('axway team user remove <org> <team> <user>')}`;
		}
	}
};
