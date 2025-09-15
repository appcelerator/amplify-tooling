import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
	commands: [
		`${__dirname}/user/activity.js`,
		`${__dirname}/user/credentials.js`,
		`${__dirname}/user/update.js`,
		`${__dirname}/user/view.js`
	],
	desc: 'User commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.',
	help: {
		header({ style }) {
			return style.red(this.desc);
		}
	}
};
