import CLI from 'cli-kit';

import { readFileSync } from 'fs';
import { resolve } from 'path';

const { version } = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json')));

export default new CLI({
	commands: `${__dirname}/commands`,
	desc: 'The Axway Auth CLI authenticates with the Axway Amplify Platform, manages access tokens, and retreives user information.',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  Log into a platform account using a web browser:
    ${style.highlight('axway auth login')}

  Log into a service account using a PEM formatted secret key:
    ${style.highlight('axway auth login --client-id <id> --secret-file <path>')}

  Log into a service account using a client secret:
    ${style.highlight('axway auth login --client-id <id> --client-secret <token> --service')}

  List all authenticated accounts:
    ${style.highlight('axway auth list')}

  Show the current default selected account:
    ${style.highlight('axway auth whoami')}

  Switch default account and org:
    ${style.highlight('axway auth switch')}

  Log out of an account:
    ${style.highlight('axway auth logout')}`;
		}
	},
	helpExitCode: 2,
	name: 'amplify-cli-auth',
	options: {
		'--base-url [url]': { hidden: true },
		'--client-id [id]': { hidden: true },
		'--env [name]':     'The environment to use',
		'--realm [realm]':  { hidden: true }
	},
	version
});
