import Command from '../../lib/command.js';
import { initSDK } from '../../lib/amplify-sdk/index.js';

export default class AuthServerInfo extends Command {
	static override summary = 'Show authentication server info.';

	static override description = 'Displays detailed information about the authentication server.';

	static override authenticated = false;

	static override enableJsonFlag = true;

	async run(): Promise<any> {
		const { config } = await this.parse(AuthServerInfo);

		// Initialize SDK manually since this command doesn't require authentication
		const sdk = await initSDK({}, config);
		const info = await sdk.auth.serverInfo();

		if (this.jsonEnabled()) {
			return info;
		}

		this.log(JSON.stringify(info, null, 2));
	}
}
