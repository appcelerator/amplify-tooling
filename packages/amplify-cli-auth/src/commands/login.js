export default {
	autoHideBanner: false,
	async banner(state) {
		// this is a hack to conditionally render the banner based on the parsed args
		const { argv, cmd } = state;
		if (!argv.json && cmd.parent) {
			const banner = cmd.parent.prop('banner');
			return typeof banner === 'function' ? await banner(state) : banner;
		}
	},
	desc: 'Log in to the Axway Amplify Platform',
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
    ${style.highlight('axway auth login --client-id <id> --client-secret <token> --service')}`;
		}
	},
	options: {
		'--base-url [url]':          { hidden: true },
		'--client-id [id]':          'The CLI specific client ID',
		'--realm [name]':            { hidden: true },
		'--force':                   'Re-authenticate even if the account is already authenticated',
		'--json': {
			callback: ({ ctx, value }) => ctx.jsonMode = value,
			desc: 'Outputs authenticated account as JSON'
		},
		'--no-launch-browser':       'Display the authentication URL instead of opening it in the default web browser',
		'-c, --client-secret [key]': 'A secret key used to authenticate',
		'-s, --secret-file [path]':  'Path to the PEM key used to authenticate',
		'--service':                 'Authenticates client secret for non-platform service account',
		'-u, --username [user]':     'Username to authenticate with',
		'-p, --password [pass]':     'Password to authenticate with'
	},
	async action({ argv, cli, console }) {
		const { default: snooplogg } = require('snooplogg');
		const { initSDK, isHeadless } = require('@axway/amplify-cli-utils');
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
		const { highlight } = snooplogg.styles;

		// perform the login
		const manual = !argv.launchBrowser;

		// show the url and wait for the user to open it
		try {
			if (manual) {
				account = await sdk.auth.login({ manual });
				const { cancel, promise, url } = account;

				if (promise) {
					promise.catch(err => {
						console.error(`${process.platform === 'win32' ? 'x' : '✖'} ${err.toString()}`);
						process.exit(1);
					});

					process.on('SIGINT', () => cancel());

					console.log(`Please open following link in your browser:\n\n  ${highlight(url)}\n`);
					account = await sdk.auth.loadSession(await promise);
				}
			} else {
				account = await sdk.auth.login({
					force: argv.force,
					onOpenBrowser() {
						if (isHeadless()) {
							throw new Error('Only authenticating with a service account is supported in headless environments');
						} else if (!argv.json) {
							console.log('Launching web browser to login...');
						}
					}
				});
			}
		} catch (err) {
			if (err.code === 'EAUTHENTICATED') {
				({ account } = err);
				if (argv.json) {
					account.default = config.get('auth.defaultAccount') === account.name;
					console.log(JSON.stringify(account, null, 2));
				} else if (account.isPlatform && account.org?.name) {
					console.log(`You are already logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
				} else {
					console.log(`You are already logged in as ${highlight(account.user.email || account.name)}.`);
				}
				return;
			}

			throw err;
		}

		// determine if the account is the default
		const accounts = await sdk.auth.list();
		if (accounts.length === 1) {
			config.set('auth.defaultAccount', account.name);
			config.set(`auth.defaultOrg.${account.hash}`, account.org.guid);
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

		if (account.isPlatform && account.org?.name) {
			console.log(`You are logged into ${highlight(account.org.name)} as ${highlight(account.user.email || account.name)}.`);
		} else {
			console.log(`You are logged in as ${highlight(account.user.email || account.name)}.`);
		}

		// set the current
		if (accounts.length === 1 || account.default) {
			console.log('This account has been set as the default');
		} else {
			console.log('\nTo make this account the default, run:');
			console.log(`  ${highlight(`axway config set auth.defaultAccount ${account.name}`)}`);
		}
	}
};
