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
    ${style.highlight('axway auth login --client-id <id> --client-secret <token>')}

  Log into a service account with platform tooling credentials:
    ${style.highlight('axway auth login --client-id <id> --secret-file <path> --username <email>')}
  or
    ${style.highlight('axway auth login --client-id <id> --client-secret <key> --username <email>')}

  To set your Platform Tooling password, visit https://platform.axway.com/#/user/credentials`;
		}
	},
	options: [
		'General',
		{
			'--force':                   'Re-authenticate even if the account is already authenticated',
			'--json': {
				callback: ({ ctx, value }) => ctx.jsonMode = value,
				desc: 'Outputs authenticated account as JSON'
			},
			'--no-launch-browser':       'Display the authentication URL instead of opening it in the default web browser'
		},
		'Service Accounts',
		{
			'--client-id [id]':          'The CLI specific client ID',
			'-c, --client-secret [key]': 'The service account\'s client secret key',
			'-p, --password [pass]':     'Your Platform Tooling password; requires --client-secret or --secret-file',
			'-s, --secret-file [path]':  'Path to the PEM formatted private key',
			'-u, --username [email]':    'Your email address used to log into the Amplify Platform; requires --client-secret or --secret-file'
		}
	],
	async action({ argv, cli, console }) {
		const { default: snooplogg } = require('snooplogg');
		const { getAuthConfigEnvSpecifier, initSDK, isHeadless } = require('@axway/amplify-cli-utils');
		const { renderAccountInfo } = require('../lib/info');
		const { prompt } = require('enquirer');

		// prompt for the username and password
		if (argv.username !== undefined) {
			if (!argv.clientSecret && !argv.secretFile) {
				throw new Error('Username/password can only be specified when using --client-secret or --secret-file');
			}

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

			if (questions.length) {
				if (argv.json) {
					console.error(JSON.stringify({ error: '--username and --password are required when --json is set' }, null, 2));
					process.exit(1);
				}

				Object.assign(argv, await prompt(questions));
				console.log();
			}
		}

		const { config, sdk } = initSDK({
			baseUrl:        argv.baseUrl,
			clientId:       argv.clientId,
			clientSecret:   argv.clientSecret,
			env:            argv.env,
			realm:          argv.realm,
			secretFile:     argv.secretFile,
			serviceAccount: !!argv.clientSecret
		});
		let account;
		const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);
		const { highlight, note } = snooplogg.styles;

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
					},
					password: argv.password,
					username: argv.username
				});
			}
		} catch (err) {
			if (err.code === 'EAUTHENTICATED') {
				({ account } = err);
				if (argv.json) {
					account.default = config.get(`${authConfigEnvSpecifier}.defaultAccount`) === account.name;
					console.log(JSON.stringify(account, null, 2));
					return;
				}

				if (account.isPlatform && account.org?.name) {
					console.log(`You are already logged into ${highlight(account.org.name)} ${note(`(${account.org.guid})`)} as ${highlight(account.user.email || account.name)}.`);
				} else {
					console.log(`You are already logged in as ${highlight(account.user.email || account.name)}.`);
				}
				console.log(await renderAccountInfo(account, config, sdk));
				return;
			}

			throw err;
		}

		// determine if the account is the default
		const accounts = await sdk.auth.list({ validate: true });
		if (accounts.length === 1) {
			config.set(`${authConfigEnvSpecifier}.defaultAccount`, account.name);
			config.set(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`, account.org.guid);
			config.save();
			account.default = true;
		} else if (config.get(`${authConfigEnvSpecifier}.defaultAccount`) === account.name) {
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
			console.log(`You are logged into ${highlight(account.org.name)} ${note(`(${account.org.guid})`)} as ${highlight(account.user.email || account.name)}.`);
		} else {
			console.log(`You are logged in as ${highlight(account.user.email || account.name)}.`);
		}

		console.log(await renderAccountInfo(account, config, sdk));

		// set the current
		if (accounts.length === 1 || account.default) {
			console.log('This account has been set as the default.');
		} else {
			console.log('\nTo make this account the default, run:');
			console.log(`  ${highlight(`axway config set ${authConfigEnvSpecifier}.defaultAccount ${account.name}`)}`);
		}
	}
};
