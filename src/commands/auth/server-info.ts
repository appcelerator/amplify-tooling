import Command from '../../lib/command.js';

export default class AuthServerInfo extends Command {
	static override summary = 'Show authentication server info.';

	static override description = 'Displays detailed information about the authentication server.';

	static override enableJsonFlag = true;

	async run(): Promise<void> {
		const { sdk } = await this.parse(AuthServerInfo);
		const info = await sdk.auth.serverInfo();

		if (this.jsonEnabled()) {
			return info;
		}

		this.log(JSON.stringify(info, null, 2));
	}
}
