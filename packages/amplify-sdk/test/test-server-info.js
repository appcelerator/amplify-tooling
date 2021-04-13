import { Auth } from '../dist/index';
import { createServer, stopServer } from './common';
import serverInfo from './server-info.json';

describe('Server Info', () => {
	afterEach(stopServer);

	it('should fetch server info', async function () {
		this.server = await createServer();

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
