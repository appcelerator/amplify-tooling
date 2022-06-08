import fs from 'fs';
import path from 'path';
import { Auth } from '../src/index.js';
import { createServer, stopServer } from './common.js';
import { expect } from 'chai';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '/server-info.json'), 'utf8'));

describe('Server Info', () => {
	afterEach(stopServer);

	it('should fetch server info', async function () {
		this.server = await createServer();

		const auth = new  Auth({
			baseUrl:        'http://127.0.0.1:1337',
			clientId:       'test_client',
			realm:          'test_realm',
			tokenStoreType: null as any
		});

		const info = await auth.serverInfo();
		expect(info).to.deep.equal(serverInfo);
	});
});
