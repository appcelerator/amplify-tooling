import { Auth } from '../../../dist/lib/amplify-sdk/index.js';
import serverInfo from '../../helpers/server-info.json' with { type: 'json' };

describe('Server Info', () => {

	it('should fetch server info', async function () {
		const auth = new Auth({
			baseUrl:        'http://127.0.0.1:8555',
			clientId:       'test_client',
			realm:          'test_realm',
			tokenStoreType: null
		});

		const info = await auth.serverInfo();
		expect(info).to.deep.equal(serverInfo);
	});
});
