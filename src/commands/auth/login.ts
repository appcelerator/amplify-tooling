import { highlight } from '../../lib/logger.js';
import { getAuthConfigEnvSpecifier, initSDK } from '../../lib/utils.js';
import { renderAccountInfo } from '../../lib/auth/info.js';

import { input, password, select } from '@inquirer/prompts';

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
			return `Log in to the Axway Amplify Platform using one or more service accounts at
the same time.

Once authenticated, the account's current team is set to its configured default
team to use for "axway" commands.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  Log in with authentication method prompts:
    ${style.highlight('axway auth login')}

  Log into a service account using a PEM formatted secret key:
    ${style.highlight('axway auth login --client-id <id> --secret-file <path>')}

  Log into a service account using a client secret:
    ${style.highlight('axway auth login --client-id <id> --client-secret <token>')}`;
		}
	},
	options: [
		{
			'--client-id [id]':          'The service account\'s client ID',
			'-c, --client-secret [key]': 'The service account\'s client secret key',
			'-s, --secret-file [path]':  'Path to the PEM formatted private key',
		},
		'General',
		{
			'--force':                   'Re-authenticate even if the account is already authenticated',
			'--json': {
				callback: ({ ctx, value }) => ctx.jsonMode = value,
				desc: 'Outputs authenticated account as JSON'
			},
		}
	],
	async action({ argv, cli, console }) {
		// prompt for the username and password
		if (argv.username !== undefined) {
			throw new Error('Platform Username and Password authentication is no longer supported. Use a different authentication method.');
		}

		if (argv.json && (!argv.clientId || (!argv.clientSecret && !argv.secretFile))) {
			console.error(JSON.stringify({ error: '--client-id and either --client-secret or --secret-file are required when --json is set' }, null, 2));
			process.exit(1);
		}

		if (!argv.clientId || typeof argv.clientId !== 'string') {
			argv.clientId = await input({
				message: 'Client ID:',
				validate: s => (s ? true : 'Please enter your client ID')
			});
		}

		if (!argv.clientSecret && !argv.secretFile) {
			const authMethod = await select<string>({
				message: 'Select authentication method:',
				choices: [ 'Client Secret', 'Client Certificate' ]
			});

			if (authMethod === 'Client Secret' && (!argv.clientSecret || typeof argv.clientSecret !== 'string')) {
				argv.clientSecret = await password({
					message: 'Client Secret:',
					mask: true,
					validate: s => (s ? true : 'Please enter your client secret')
				});
			}

			if (authMethod === 'Client Certificate' && (!argv.secretFile || typeof argv.secretFile !== 'string')) {
				argv.secretFile = await input({
					message: 'Path to the PEM formatted private key:',
					validate: s => (s ? true : 'Please enter the path to your PEM formatted private key file')
				});
			}
			console.log();
		}

		const { config, sdk } = await initSDK({
			baseUrl:        argv.baseUrl,
			clientId:       argv.clientId,
			clientSecret:   argv.clientSecret,
			env:            argv.env,
			realm:          argv.realm,
			secretFile:     argv.secretFile
		});
		let account;
		const authConfigEnvSpecifier = getAuthConfigEnvSpecifier(sdk.env.name);

		// Attempt to log in using the provided credentials
		try {
			account = await sdk.auth.login({ force: argv.force });
		} catch (err) {
			if (err.code === 'EAUTHENTICATED') {
				({ account } = err);
				if (argv.json) {
					account.default = await config.get(`${authConfigEnvSpecifier}.defaultAccount`) === account.name;
					console.log(JSON.stringify(account, null, 2));
					return;
				}

				console.log(`You are already logged into a ${highlight('service')} account as ${highlight(account.name)}.`);
				console.log(await renderAccountInfo(account, config, sdk));
				return;
			}

			throw err;
		}

		// determine if the account is the default
		// note: do not validate the account we just logged in as
		const accounts = await sdk.auth.list({ validate: true, skip: [ account.name ] });
		if (accounts.length === 1) {
			await config.set(`${authConfigEnvSpecifier}.defaultAccount`, account.name);
			await config.set(`${authConfigEnvSpecifier}.defaultOrg.${account.hash}`, account.org.guid);

			if (account.team) {
				await config.set(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`, account.team.guid);
			} else {
				await config.delete(`${authConfigEnvSpecifier}.defaultTeam.${account.hash}`);
			}

			await config.save();
			account.default = true;
		} else if (await config.get(`${authConfigEnvSpecifier}.defaultAccount`) === account.name) {
			account.default = true;
		} else {
			account.default = false;
		}

		await cli.emitAction('axway:auth:login', account);

		if (argv.json) {
			console.log(JSON.stringify(account, null, 2));
			return;
		}

		console.log(`You are logged into a ${highlight('service')} account as ${highlight(account.user.email || account.name)}.`);
		console.log(await renderAccountInfo(account, config, sdk));

		// set the current
		if (accounts.length === 1 || account.default) {
			console.log('\nThis account has been set as the default.');
		} else {
			console.log('\nTo make this account the default, run:');
			console.log(`  ${highlight(`axway config set ${authConfigEnvSpecifier}.defaultAccount ${account.name}`)}`);
		}
	}
};
