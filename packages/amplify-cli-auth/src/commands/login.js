export default {
	desc: 'Log in to the Axway AMPLIFY platform',
	options: {
		'--force':                   're-authenticate even if the account is already authenticated',
		'--json':                    'outputs accounts as JSON',
		'--no-launch-browser':       'display the authentication URL instead of opening it in the default web browser',
		'--org [id|name]':           'the organization to use',
		'-c, --client-secret [key]': 'a secret key used to authenticate',
		'-s, --secret-file [path]':  'path to the PEM key used to authenticate',
		'-u, --username [user]':     'username to authenticate with',
		'-p, --password [pass]':     'password to authenticate with'
	},
	async action({ argv, console }) {
		const [
			{ initSDK },
			inquirer,
			{ default: snooplogg }
		] = await Promise.all([
			import('@axway/amplify-cli-utils'),
			import('inquirer'),
			import('snooplogg')
		]);

		// prompt for the username and password
		if (Object.prototype.hasOwnProperty.call(argv, 'username')) {
			const questions = [];

			if (!argv.username || typeof argv.username !== 'string') {
				questions.push({
					type: 'input',
					name: 'username',
					message: 'Username:',
					validate(s) {
						return s ? true : 'Please enter your username';
					}
				});
			}

			if (!argv.password || typeof argv.password !== 'string') {
				questions.push({
					type: 'password',
					name: 'password',
					message: 'Password:',
					validate(s) {
						return s ? true : 'Please enter your password';
					}
				});
			}

			if (questions.length && argv.json) {
				console.error(JSON.stringify({ error: '--username and --password are required when --json is set' }, null, '  '));
				process.exit(1);
			}

			Object.assign(argv, await inquirer.prompt(questions));
			console.log();
		}

		const { config, sdk } = initSDK({
			baseUrl:      argv.baseUrl,
			clientId:     argv.clientId,
			clientSecret: argv.clientSecret,
			env:          argv.env,
			password:     argv.password,
			realm:        argv.realm,
			secretFile:   argv.secretFile,
			username:     argv.username
		});
		const current = config.get('auth.defaultAccount');
		let account = await sdk.auth.find();

		// exit early if we are already authenticated
		if (!argv.force && account && !account.auth.expired) {
			if (argv.json) {
				account.active = current === account.name;
				console.log(JSON.stringify(account, null, 2));
			} else {
				console.log('Account already authenticated.');
			}
			return;
		}

		// perform the login
		const manual = !argv.launchBrowser;

		// 	// show the url and wait for the user to open it
		if (manual) {
			const { cancel, promise, url } = await sdk.auth.login({ manual });

			promise.catch(err => {
				console.error(err.toString());
				process.exit(1);
			});

			process.on('SIGINT', () => cancel());

			console.log(`Please open following link in your browser:\n\n  ${url}\n`);
			account = await promise;
		} else {
			account = await sdk.auth.login();
		}

		// // determine if the account is active
		const accounts = await sdk.auth.list();
		if (accounts.length === 1) {
			config.set('auth.defaultAccount', account.name);
			config.save();
			account.active = true;
		} else if (config.get('auth.defaultAccount') === account.name) {
			account.active = true;
		} else {
			account.active = false;
		}

		if (argv.json) {
			console.log(JSON.stringify(account, null, 2));
			return;
		}

		const { highlight } = snooplogg.styles;

		console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}\n`);

		// set the current
		if (accounts.length === 1) {
			console.log('This account has been set as active');
		} else if (account.active) {
			console.log('This account is active');
		} else {
			console.log('To make this account active, run:');
			console.log(`  ${highlight(`amplify config set auth.defaultAccount ${account.name}`)}`);
		}
	}
};
