import { auth } from '@axway/amplify-cli-utils';

export default {
	args: [
		{
			name: 'username',
			desc: 'username to authenticate with'
		},
		{
			name: 'password',
			desc: 'password to authenticate with'
		}
	],
	desc: 'log in to the Axway AMPLIFY platform',
	options: {
		'--secret <key>': {
			desc: 'a secret key used to authenticate'
		},
		'--secret-file <path>': {
			desc: 'path to the PEM key used to authenticate'
		}
	},
	async action({ _, argv, console }) {
		try {
			const info = await auth.login({
				baseUrl:      argv.baseUrl,
				clientId:     argv.clientId,
				clientSecret: argv.secret,
				env:          argv.env,
				password:     _[1],
				realm:        argv.realm,
				secretFile:   argv.secretFile,
				username:     _[0]
			});

			console.log(`You are logged in as ${info.preferred_username || info.email}.`);
		} catch (e) {
			console.error(e.message);
		}
	}
};
