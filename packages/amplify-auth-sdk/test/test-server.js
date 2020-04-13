import Auth, { server } from '../dist/index';

import { parse, URLSearchParams } from 'url';
import request from '@axway/amplify-request';

describe('Server', () => {
	afterEach(async () => {
		await server.stop(true);
	});

	it('should error if callback does not have an auth code', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel } = await auth.login({ manual: true });

		try {
			await request({ url: 'http://127.0.0.1:3000/callback' });
		} catch (error) {
			expect(error.statusCode).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if request id is not set', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel } = await auth.login({ manual: true });

		try {
			await request({ url: 'http://127.0.0.1:3000/callback?code=123' });
		} catch (error) {
			expect(error.statusCode).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if request id is invalid', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel } = await auth.login({ manual: true });

		try {
			await request({ url: 'http://127.0.0.1:3000/callback/foo?code=123' });
		} catch (error) {
			expect(error.statusCode).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if auth code is bad', async function () {
		this.timeout(5000);

		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel, promise, url } = await auth.login({ manual: true });
		const redirect_uri = new URLSearchParams(parse(url).query).get('redirect_uri');
		const id = redirect_uri.match(/\/callback\/([A-Z0-9]+)/)[1];

		// squeltch unhandled rejections
		promise.catch(() => {});

		try {
			await request({ url: `http://127.0.0.1:3000/callback/${id}?code=123` });
		} catch (error) {
			expect(error.statusCode).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if requesting non-callback url', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel } = await auth.login({ manual: true });

		try {
			await request({ url: 'http://127.0.0.1:3000' });
		} catch (error) {
			expect(error.statusCode).to.equal(404);
		} finally {
			await cancel();
		}
	});

	it('should reject login when manual login is cancelled', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { promise } = await auth.login({ manual: true });

		setImmediate(() => server.stop(true));

		return promise
			.then(() => {
				throw new Error('Expected promise to be rejected with server stopped error');
			}, err => {
				expect(err.message).to.equal('Server stopped');
			});
	});
});
