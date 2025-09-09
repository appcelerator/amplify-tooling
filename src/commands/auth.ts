import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default {
	commands: [
		`${__dirname}/auth/list.js`,
		`${__dirname}/auth/login.js`,
		`${__dirname}/auth/logout.js`,
		`${__dirname}/auth/server-info.js`,
		`${__dirname}/auth/switch.js`,
		`${__dirname}/auth/whoami.js`
	],
	desc: 'The Axway Auth CLI authenticates with the Axway Amplify Platform, manages access tokens, and retreives user information',
	help: {
		header({ style }) {
			return `The Axway CLI auth command allows you to authenticate with the Amplify platform
under one or more accounts and switch between them. You can log in using your
platform account as well as one or more service accounts at the same time.

To log in using a platform account, a desktop web browser is required. Headless
environments, such as a SSH terminal, are not supported when authenticating
into platform accounts.

A service account can be used for both desktop and headless environments.
However, if authenticating in a headless environment, you must set the token
store type to “file”:

  ${style.highlight('axway config set auth.tokenStoreType file')}`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  Log into a platform account using a web browser:
    ${style.highlight('axway auth login')}

  Log into a service account using a PEM formatted secret key:
    ${style.highlight('axway auth login --client-id <id> --secret-file <path>')}

  Log into a service account using a client secret:
    ${style.highlight('axway auth login --client-id <id> --client-secret <token>')}

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
	name: 'auth',
	options: {
		'--base-url [url]': { hidden: true, redact: false },
		'--realm [realm]':  { hidden: true, redact: false }
	}
};
