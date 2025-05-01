import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
	commands: `${__dirname}/commands`,
	desc: 'Package manager for Axway products',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  List all available packages:
    ${style.highlight('axway pm search')}

  View package details:
    ${style.highlight('axway pm view <package>')}

  Install a package:
    ${style.highlight('axway pm install <package>')}`;
		}
	}
};
