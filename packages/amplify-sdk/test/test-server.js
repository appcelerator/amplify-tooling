import got from 'got';
import { Auth } from '../dist/index';

describe('Server', () => {
	it('should error if callback does not have an auth code', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel } = await auth.login({ manual: true });

		try {
			await got('http://127.0.0.1:3000/callback');
		} catch (error) {
			expect(error.response.statusCode).to.equal(400);
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
			await got('http://127.0.0.1:3000/callback?code=123');
		} catch (error) {
			expect(error.response.statusCode).to.equal(400);
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
			await got('http://127.0.0.1:3000/callback/foo?code=123');
		} catch (error) {
			expect(error.response.statusCode).to.equal(400);
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
		const redirect_uri = new URL(url).searchParams.get('redirect_uri');
		const id = redirect_uri.match(/\/callback\/([A-Z0-9]+)/)[1];

		// squeltch unhandled rejections
		promise.catch(() => {});

		try {
			await got(`http://127.0.0.1:3000/callback/${id}?code=123`);
		} catch (error) {
			expect(error.response.statusCode).to.equal(400);
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
			await got('http://127.0.0.1:3000');
		} catch (error) {
			expect(error.response.statusCode).to.equal(400);
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

		const { cancel, promise } = await auth.login({ manual: true });

		await cancel();

		expect(promise).to.eventually.be.rejectedWith(Error, 'Expected promise to be rejected with server stopped error');
	});
});
