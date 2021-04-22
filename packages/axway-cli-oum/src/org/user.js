export default {
	aliases: '!users',
	commands: `${__dirname}/user`,
	desc: 'Manage organization users',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  You may specify an organization by name, id, or guid.

  List all users in your currently selected organization:
    ${style.highlight('axway org user list')}

  List all users for a specific organization:
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
	},
	name: 'user'
};
