import Command from '../../lib/command.js';
import { initSDK } from '../../lib/utils.js';

export default class AuthServerInfo extends Command {
	static override summary = 'Show authentication server info.';
	static override description = 'Displays detailed information about the authentication server.';

	static override enableJsonFlag = true;

	async run(): Promise<void> {
		await this.parse(AuthServerInfo);
		const sdk = await initSDK();
		const info = await sdk.auth.serverInfo();

		if (this.jsonEnabled()) {
			return info;
		} else {
			this.log(JSON.stringify(info, null, 2));
		}
	}
}
