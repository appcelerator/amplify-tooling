import { auth, loadConfig } from '@axway/amplify-cli-utils';

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
		const config = loadConfig();

		const params = auth.buildParams({
			baseUrl:      argv.baseUrl,
			clientId:     argv.clientId,
			clientSecret: argv.secret,
			env:          argv.env,
			password:     _[1],
			realm:        argv.realm,
			secretFile:   argv.secretFile,
			username:     _[0]
		}, config);

		const { accessToken, accounts, userInfo } = await auth.login(params);

		console.log(`You are logged in as ${userInfo.preferred_username}.\n`);

		// set the current
		if (accounts.length === 1) {
			config.set('auth.account', userInfo.preferred_username);
			await config.save(config.userConfigFile);
			console.log('This account has been set as active.');
		} else if (config.get('auth.account') === userInfo.preferred_username) {
			console.log('This account is active.');
		} else {
			console.log('To make this account active, run:');
			console.log('```bash');
			console.log(`amplify config set account ${userInfo.preferred_username}`);
			console.log('```');
		}
	}
};
