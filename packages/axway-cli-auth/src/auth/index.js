export default {
	commands: [
		`${__dirname}/list.js`,
		`${__dirname}/login.js`,
		`${__dirname}/logout.js`,
		`${__dirname}/server-info.js`,
		`${__dirname}/switch.js`,
		`${__dirname}/whoami.js`
	],
	desc: 'The Axway Auth CLI authenticates with the Axway Amplify Platform, manages access tokens, and retreives user information',
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
