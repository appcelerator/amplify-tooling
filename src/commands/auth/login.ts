import Command from '../../lib/command.js';
import { Flags } from '@oclif/core';
import { input, password, select } from '@inquirer/prompts';
import { highlight } from '../../lib/logger.js';
import { initSDK } from '../../lib/utils.js';
import { renderAccountInfo } from '../../lib/auth/info.js';

export default class AuthLogin extends Command {
	static override summary = 'Log in to the Axway Amplify Platform.';

	static override description = `You are able to authenticate using one or more service accounts at the same time.

Once authenticated, the account's current team is set to its configured default team to use for "<%= config.bin %>" commands.`;

	static override flags = {
		username: Flags.string({
			deprecated: true,
			description: 'The platform username (no longer supported)',
			hidden: true
		}),
		password: Flags.string({
			deprecated: true,
			description: 'The platform password (no longer supported)',
			hidden: true
		}),
		'client-id': Flags.string({
			description: 'The service account\'s client ID'
		}),
		'client-secret': Flags.string({
			char: 'c',
			description: 'The service account\'s client secret key',
			dependsOn: [ 'client-id' ],
			exclusive: [ 'secret-file' ]
		}),
		'secret-file': Flags.string({
			char: 's',
			description: 'Path to the PEM formatted private key',
			dependsOn: [ 'client-id' ],
			exclusive: [ 'client-secret' ]
		}),
		force: Flags.boolean({
			description: 'Re-authenticate even if the account is already authenticated'
		}),
	};

	static override examples = [
		{
			description: 'Log in with authentication method prompts:',
			command: highlight('<%= config.bin %> <%= command.id %>'),
		},
		{
			description: 'Log into a service account using a PEM formatted secret key:',
			command: highlight('<%= config.bin %> <%= command.id %> --client-id <id> --secret-file <path>'),
		},
		{
			description: 'Log into a service account using a client secret:',
			command: highlight('<%= config.bin %> <%= command.id %> --client-id <id> --client-secret <token>')
		}
	];

	static override enableJsonFlag = true;

	async run() {
		const { config, flags } = await this.parse(AuthLogin);

		if (flags.username !== undefined) {
			this.error('Platform Username and Password authentication is no longer supported. Use a different authentication method.');
		}

		if (this.jsonEnabled() && (!flags['client-id'] || (!flags.clientSecret && !flags.secretFile))) {
			return this.error(JSON.stringify({ error: '--client-id and either --client-secret or --secret-file are required when --json is set' }, null, 2), { exit: 1 });
		}

		if (!flags['client-id']) {
			flags['client-id'] = await input({
				message: 'Client ID:',
				validate: s => (s ? true : 'Please enter your client ID')
			});
		}

		if (!flags['client-secret'] && !flags['secret-file']) {
			const authMethod = await select<string>({
				message: 'Select authentication method:',
				choices: [ 'Client Secret', 'Client Certificate' ]
			});

			if (authMethod === 'Client Secret' && !flags['client-secret']) {
				flags['client-secret'] = await password({
					message: 'Client Secret:',
					mask: true,
					validate: s => (s ? true : 'Please enter your client secret')
				});
			}

			if (authMethod === 'Client Certificate' && !flags['secret-file']) {
				flags['secret-file'] = await input({
					message: 'Path to the PEM formatted private key:',
					validate: s => (s ? true : 'Please enter the path to your PEM formatted private key file')
				});
			}
			this.log('');
		}

		const sdk = await initSDK({
			clientId: flags['client-id'],
			clientSecret: flags['client-secret'],
			secretFile: flags['secret-file']
		});
		let account;

		try {
			account = await sdk.auth.login({ force: flags.force });
		} catch (err: any) {
			if (err.code === 'EAUTHENTICATED') {
				({ account } = err);
				if (this.jsonEnabled()) {
					account.default = await config.get('auth.defaultAccount') === account.name;
					return account;
				}
				this.log(`You are already logged into a ${highlight('service')} account as ${highlight(account.name)}.`);
				this.log(await renderAccountInfo(account, config, sdk));
				return;
			}
			throw err;
		}

		const accounts = await sdk.auth.list({ validate: true, skip: [ account.name ] });
		if (accounts.length === 1) {
			await config.set('auth.defaultAccount', account.name);

			if (account.team) {
				await config.set(`auth.defaultTeam.${account.hash}`, account.team.guid);
			} else {
				await config.delete(`auth.defaultTeam.${account.hash}`);
			}

			await config.save();
			account.default = true;
		} else if (await config.get('auth.defaultAccount') === account.name) {
			account.default = true;
		} else {
			account.default = false;
		}

		if (this.jsonEnabled()) {
			return account;
		}

		this.log(`You are logged into a ${highlight('service')} account as ${highlight(account.user.email || account.name)}.`);
		this.log(await renderAccountInfo(account, config, sdk));

		if (accounts.length === 1 || account.default) {
			this.log('\nThis account has been set as the default.');
		} else {
			this.log('\nTo make this account the default, run:');
			this.log(`  ${highlight(`axway config set auth.defaultAccount ${account.name}`)}`);
		}
	}
}
