import chalk from 'chalk';
import activity from './user/activity.js';
import credentials from './user/credentials.js';
import update from './user/update.js';
import view from './user/view.js';

export default {
	commands: {
		activity,
		credentials,
		update,
		view
	},
	desc: 'User commands are no longer supported as of version 5.0.0. Their references will be removed in a subsequent release.',
	help: {
		header() {
			return chalk.red(this.desc);
		}
	}
};
