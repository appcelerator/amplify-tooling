export default {
	autoHideBanner: false,
	desc: 'Log in to the Axway AMPLIFY platform',
	options: {
		'--base-url [url]':          { hidden: true },
		'--client-id [id]':          'The CLI specific client ID',
		'--realm [name]':            { hidden: true },
		'--force':                   'Re-authenticate even if the account is already authenticated',
		'--json':                    'Outputs authenticated account as JSON',
		'--no-launch-browser':       'Display the authentication URL instead of opening it in the default web browser',
		'-c, --client-secret [key]': 'A secret key used to authenticate',
		'-s, --secret-file [path]':  'Path to the PEM key used to authenticate',
		'--service':                 'Authenticates client secret for non-platform service account',
		'-u, --username [user]':     'Username to authenticate with',
		'-p, --password [pass]':     'Password to authenticate with'
	},
	async action({ argv, cli, console, exitCode }) {
		const { default: snooplogg } = require('snooplogg');
		const { initSDK } = require('@axway/amplify-cli-utils');
		const { prompt } = require('enquirer');

		// prompt for the username and password
		if (argv.username !== undefined) {
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
				console.error(JSON.stringify({ error: '--username and --password are required when --json is set' }, null, 2));
				process.exit(1);
			}

			Object.assign(argv, await prompt(questions));
			console.log();
		}

		const { config, sdk } = initSDK({
			baseUrl:        argv.baseUrl,
			clientId:       argv.clientId,
			clientSecret:   argv.clientSecret,
			env:            argv.env,
			password:       argv.password,
			realm:          argv.realm,
			secretFile:     argv.secretFile,
			serviceAccount: argv.service,
			username:       argv.username
		});
		let account;
		const { alert, highlight } = snooplogg.styles;

		// perform the login
		const manual = !argv.launchBrowser;

		// show the url and wait for the user to open it
		if (manual) {
			const { cancel, promise, url } = await sdk.auth.login({ manual });

			promise.catch(err => {
				console.error(`${process.platform === 'win32' ? 'x' : '✖'} ${err.toString()}`);
				process.exit(1);
			});

			process.on('SIGINT', () => cancel());

			console.log(`Please open following link in your browser:\n\n  ${highlight(url)}\n`);
			account = await sdk.auth.loadSession(await promise);
		} else {
			try {
				account = await sdk.auth.login({ force: argv.force });
			} catch (err) {
				if (err.code === 'EAUTHENTICATED') {
					({ account } = err);
					if (argv.json) {
						account.default = config.get('auth.defaultAccount') === account.name;
						console.log(JSON.stringify(account, null, 2));
					} else {
						console.log(`You are already logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
					}
					return;
				} else if (err.code === 'ERR_AUTH_FAILED') {
					console.error(alert(`${process.platform === 'win32' ? 'x' : '✖'} ${err.message}`));
					exitCode(1);
					return;
				}
				throw err;
			}
		}

		// determine if the account is the default
		const accounts = await sdk.auth.list();
		if (accounts.length === 1) {
			config.set('auth.defaultAccount', account.name);
			config.save();
			account.default = true;
		} else if (config.get('auth.defaultAccount') === account.name) {
			account.default = true;
		} else {
			account.default = false;
		}

		await cli.emitAction('axway:auth:login', account);

		if (argv.json) {
			console.log(JSON.stringify(account, null, 2));
			return;
		}

		if (account.org?.name) {
			console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.\n`);
		} else {
			console.log(`You are logged as ${highlight(account.user.email || account.name)}.\n`);
		}

		// set the current
		if (accounts.length === 1) {
			console.log('This account has been set as the default');
		} else if (account.default) {
			console.log('This account is the default');
		} else {
			console.log('To make this account the default, run:');
			console.log(`  ${highlight(`amplify config set auth.defaultAccount ${account.name}`)}`);
		}
	}
};
