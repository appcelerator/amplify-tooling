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

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(new URL(url).searchParams.get('redirect_uri'));

		try {
			await got(`${redirect_uri.origin}/callback`);
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

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(url).searchParams.get('redirect_uri');

		try {
			await got(`${redirect_uri}?code=123`);
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

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(url).searchParams.get('redirect_uri');

		try {
			await got(`${redirect_uri}/foo?code=123`);
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

		// squeltch unhandled rejections
		promise.catch(() => {});

		try {
			await got(`${redirect_uri}?code=123`);
		} catch (error) {
			console.log(error);
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

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(new URL(url).searchParams.get('redirect_uri'));

		try {
			await got(redirect_uri.origin);
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
