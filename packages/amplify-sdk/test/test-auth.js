import os from 'os';
import path from 'path';
import SDK from '../dist/index';

describe('auth', () => {
	it('should list authenticated accounts', async function () {
		this.timeout(60000);

		const axwayHome = path.join(os.homedir(), '.axway');

		const sdk = new SDK({
			clientId:      'amplify-cli',
			homeDir:       axwayHome,
			tokenStoreDir: axwayHome,
			realm:         'Broker'
		});

		const accounts = await sdk.auth.list();
		expect(accounts).to.be.an('array');

		// const account = await sdk.auth.login();
		// console.log(account);
	});
});
