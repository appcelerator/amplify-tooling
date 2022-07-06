import path from 'path';
import { CLICommand, CLIHelpOptions } from 'cli-kit';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
	commands: [
		`${__dirname}/activity.js`,
		`${__dirname}/credentials.js`,
		`${__dirname}/update.js`,
		`${__dirname}/view.js`
	],
	desc: 'Manage your user settings',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		},
		footer({ style }: CLIHelpOptions): string {
			return `${style.heading('Examples:')}

  You must be authenticated into an Amplify Platform account to view or update
  your user settings. Run ${style.highlight('"axway auth login"')} to authenticate.

  View your user account details:
    ${style.highlight('axway user view')}

  Update your first name, last name, or phone number:
    ${style.highlight('axway user update --firstname <name> --lastname <name>')}

  View your recent activity report:
    ${style.highlight('axway user activity')}

  Open web browser to change your password:
    ${style.highlight('axway user credentials')}`;
		}
	}
};
