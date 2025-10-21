import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { heading, highlight } from '../../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
	aliases: '!users',
	commands: `${__dirname}/user`,
	desc: 'Manage organization users',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer() {
			return `${heading('Examples:')}

  You may specify an organization by name, id, or guid.

  List all users in your currently selected organization:
    ${highlight('axway org user list')}

  List all users for a specific organization:
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
	},
	name: 'user'
};
