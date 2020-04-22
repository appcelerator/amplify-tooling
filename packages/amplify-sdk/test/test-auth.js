import os from 'os';
import path from 'path';
import SDK from '../dist/index';

describe('auth', () => {
	it('should login', async function () {
		this.timeout(60000);

		const axwayHome = path.join(os.homedir(), '.axway');

		const sdk = new SDK({
			clientId:      'amplify-cli',
			homeDir:       axwayHome,
			tokenStoreDir: axwayHome,
			realm:         'Broker'
		});

		// console.log(await sdk.auth.list());

		let account = await sdk.auth.login();
		console.log(account);

		// console.log(await sdk.auth.list());

		// console.log(sdk.ti.getAppVerifyURL());

		// console.log(await sdk.org.getEnvironments(account));

		// console.log(await sdk.aca.getUploadURL(account, '6cfa6cad-b3d2-4ac9-9444-fdb4468c8778'));

		console.log(await sdk.ti.getApp(account, '6cfa6cad-b3d2-4ac9-9444-fdb4468c8778'));
		console.log(await sdk.ti.setApp(account, '<ti:app><name>appctestapp3</name><id>com.appcelerator.testapp3</id><guid>6cfa6cad-b3d2-4ac9-9444-fdb4468c8778</guid></ti:app>'));

		// console.log(await sdk.ti.getDownloads(account));

		// account = await sdk.auth.switchOrg({ account, orgId: 14301 });
		// console.log(account);

		// console.log(await sdk.mbs.getUsers({ account, env: 'production', groupId: '0886b117-b09e-4b55-9444-31c49f43060f' }));
	});
});
