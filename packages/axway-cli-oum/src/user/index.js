import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
	commands: [
		`${__dirname}/activity.js`,
		`${__dirname}/credentials.js`,
		`${__dirname}/update.js`,
		`${__dirname}/view.js`
	],
	desc: 'Manage your user settings',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  You must be authenticated into an Amplify Platform account to view or update
  your user settings. Run ${style.highlight('"axway auth login"')} to authenticate.

  View your user account details:
    ${style.highlight('axway user view')}

  Update your first name, last name, or phone number:
    ${style.highlight('axway user update --firstname <name> --lastname <name>')}
    ${style.highlight('axway user update --phone <number>')}

  View your recent activity report:
    ${style.highlight('axway user activity')}

  Open web browser to change your password:
    ${style.highlight('axway user credentials')}`;
		}
	}
};
