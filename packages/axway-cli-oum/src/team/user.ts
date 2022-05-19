export default {
	aliases: '!users',
	commands: `${__dirname}/user`,
	desc: 'Manage team users',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  You may specify an organization by name, id, or guid as well as the team by
  name or guid and user by email address or guid.

  List all users in a team:
    ${style.highlight('axway team user list <org>')}

  View available user roles:
    ${style.highlight('axway team user roles')}

  Add a user to a team:
    ${style.highlight('axway team user add <org> <team> <user> --role <role>')}

  Change a user's role within a team:
    ${style.highlight('axway team user update <org> <team> <user> --role <role>')}

  Remove a user from a team:
    ${style.highlight('axway team user remove <org> <team> <user>')}`;
		}
	},
	name: 'user'
};
