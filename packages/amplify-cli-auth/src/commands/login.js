export default {
	desc: 'log in to the Axway AMPLIFY platform',
	options: {
		'--json':                    'outputs accounts as JSON',
		'-c, --client-secret <key>': 'a secret key used to authenticate',
		'-s, --secret-file <path>':  'path to the PEM key used to authenticate',
		'-u, --username <user>':     'username to authenticate with',
		'-p, --password <pass>':     'password to authenticate with'
	},
	async action({ _, argv, console }) {
		console.log(argv);
		/*
		const { Auth } = await import('@axway/amplify-auth-sdk');
		const { auth, loadConfig } = await import('@axway/amplify-cli-utils');

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

		const client = new Auth(params);

		const account = await client.getAccount(params);
		if (account && !account.expired) {
			if (argv.json) {
				console.log(JSON.stringify(account, null, '  '));
			} else {
				console.log('Account already logged in.');
			}
			return;
		}

		const { accessToken, userInfo } = await client.login(params);
		const accounts = await client.list();
		let active = false;

		if (accounts.length === 1) {
			config.set('auth.defaultAccount', userInfo.preferred_username);
			await config.save(config.userConfigFile);
			active = true;
		} else if (config.get('auth.defaultAccount') === userInfo.preferred_username) {
			active = true;
		}

		if (argv.json) {
			console.log(JSON.stringify({
				accessToken,
				active,
				userInfo
			}, null, '  '));
			return;
		}

		console.log(`You are logged in as ${userInfo.preferred_username}.\n`);

		// set the current
		if (accounts.length === 1) {
			console.log('This account has been set as active.');
		} else if (active) {
			console.log('This account is active.');
		} else {
			console.log('To make this account active, run:');
			console.log('```bash');
			console.log(`amplify config set account ${userInfo.preferred_username}`);
			console.log('```');
		}
		*/
	}
};
