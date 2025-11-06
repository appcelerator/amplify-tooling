import Command from '../../lib/command.js';
import chalk from 'chalk';
import { highlight, note } from '../../lib/logger.js';

export default class Config extends Command {
	static override summary = 'Manage configuration options.';

	static override examples = [
		{
			description: 'List all config settings',
			command: '<%= config.bin %> <%= command.id %> list'
		},
		{
			description: 'Return the config as JSON',
			command: '<%= config.bin %> <%= command.id %> ls --json'
		},
		{
			description: 'Get a specific config setting',
			command: '<%= config.bin %> <%= command.id %> get home'
		},
		{
			description: 'Set a config setting',
			command: '<%= config.bin %> <%= command.id %> set env production'
		}
	];

	async run(): Promise<void> {
		await this.config.runCommand('help', [ 'config' ]);
		this.log(`${chalk.bold('SETTINGS')}
  ${highlight('auth.tokenStoreType')} ${note('[string] (default: "auto")')}
    After authenticating, access tokens are encrypted and stored in a file called the token store.
    Access to this file is restricted to only the owner (the current user).
    By default, the encryption key is stored in the system's keychain, however this feature is unavailable in headless environments such as SSH terminals and this setting must be set to "file".

    Allowed values:
      ${chalk.cyan('auto')}    Attempts to use the "secure" store, but falls back to "file" if secure store is unavailable.
      ${chalk.cyan('secure')}  Encrypts the access token and using a generated key which is stored in the system's keychain.
      ${chalk.cyan('file')}    Encrypts the access token using the embedded key.
      ${chalk.cyan('memory')}  Stores the access token in memory instead of on disk. The access tokens are lost when the process exits. This is intended for testing purposes only.
      ${chalk.cyan('null')}    Disables all forms of token persistence and simply returns the access token. Subsequent calls to login in the same process will force the authentication flow. This is intended for migration scripts and testing purposes only.

  ${highlight('network.caFile')} ${note('[string]')}
    The path to a PEM formatted certificate authority bundle used to validate untrusted SSL certificates.

  ${highlight('network.proxy')} ${note('[string]')}
    The URL of the proxy server. This proxy server URL is used for both HTTP and HTTPS requests.

    Note: If the proxy server uses a self signed certifcate, you must specify the network.caFile, set network.strictSSL to false, or set the environment variable NODE_TLS_REJECT_UNAUTHORIZED=0.

  ${highlight('network.strictSSL')} ${note('[bool] (default: true)')}
    Enforces valid TLS certificates on all outbound HTTPS requests. Set this to false if you are behind a proxy server with a self signed certificate.`);
	}
}
