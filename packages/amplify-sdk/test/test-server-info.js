import Auth from '../dist/index';

import { createLoginServer, stopLoginServer } from './common';
import { serverInfo } from './server-info';

describe('Server Info', () => {
	afterEach(stopLoginServer);

	it('should fetch server info', async function () {
		this.server = await createLoginServer();

		const auth = new  Auth({
			baseUrl:        'http://127.0.0.1:1337',
			clientId:       'test_client',
			realm:          'test_realm',
			tokenStoreType: null
		});

		const info = await auth.serverInfo();
		expect(info).to.deep.equal(serverInfo);
	});
});
