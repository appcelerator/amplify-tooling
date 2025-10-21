import list from './auth/list.js';
import login from './auth/login.js';
import logout from './auth/logout.js';
import serverInfo from './auth/server-info.js';
import switchCmd from './auth/switch.js';
import whoami from './auth/whoami.js';
import { heading, highlight } from '../lib/logger.js';

export default {
	commands: {
		list,
		login,
		logout,
		'server-info': serverInfo,
		switch: switchCmd,
		whoami
	},
	desc: 'The Axway Auth CLI authenticates with the Axway Amplify Platform, manages access tokens, and retrieves account information',
	help: {
		header() {
			return `The Axway CLI auth command allows you to authenticate with the Amplify platform
under one or more accounts and switch between them. You can log in using
one or more service accounts at the same time.

A service account can be used for both desktop and headless environments.
However, if authenticating in a headless environment, you must set the token
store type to “file”:

  ${highlight('axway config set auth.tokenStoreType file')}`;
		},
		footer() {
			return `${heading('Examples:')}

  Log into a service account using a PEM formatted secret key:
    ${highlight('axway auth login --client-id <id> --secret-file <path>')}

  Log into a service account using a client secret:
    ${highlight('axway auth login --client-id <id> --client-secret <token>')}

  List all authenticated accounts:
    ${highlight('axway auth list')}

  Show the current default selected account:
    ${highlight('axway auth whoami')}

  Switch default account and org:
    ${highlight('axway auth switch')}

  Log out of an account:
    ${highlight('axway auth logout')}`;
		}
	},
	name: 'auth',
	options: {
		'--base-url [url]': { hidden: true, redact: false },
		'--realm [realm]': { hidden: true, redact: false }
	}
};
