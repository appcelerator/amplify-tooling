import got from 'got';
import { Auth } from '../dist/index';
import snooplogg from 'snooplogg';

const { log } = snooplogg('test:amplify-sdk:server');
const { highlight } = snooplogg.styles;

describe.only('Server', () => {
	it('should error if callback does not have an auth code', async function () {
		this.timeout(10000);

		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(new URL(url).searchParams.get('redirect_uri'));

		try {
			log(`Requesting ${highlight(`${redirect_uri.origin}/callback`)}`);
			await got(`${redirect_uri.origin}/callback`);
		} catch (error) {
			if (error.response) {
				expect(error.response.statusCode).to.equal(400);
			} else {
				throw error;
			}
		} finally {
			await cancel();
		}
	});

	it('should error if request id is not set', async function () {
		this.timeout(10000);

		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(url).searchParams.get('redirect_uri');
		const redirectURL = redirect_uri.replace(/(\/callback)\/.+$/, '$1') + '?code=123';

		try {
			log(`Requesting ${highlight(redirectURL)}`);
			await got(redirectURL);
		} catch (error) {
			if (error.response) {
				expect(error.response.statusCode).to.equal(400);
			} else {
				throw error;
			}
		} finally {
			await cancel();
		}
	});

	it('should error if request id is invalid', async function () {
		this.timeout(10000);

		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(url).searchParams.get('redirect_uri');
		const redirectURL = redirect_uri.replace(/(\/callback)\/.+$/, '$1/foo') + '?code=123';

		try {
			log(`Requesting ${highlight(redirectURL)}`);
			await got(redirectURL);
		} catch (error) {
			if (error.response) {
				expect(error.response.statusCode).to.equal(400);
			} else {
				throw error;
			}
		} finally {
			await cancel();
		}
	});

	it('should error if auth code is bad', async function () {
		this.timeout(10000);

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
			log(`Requesting: ${highlight(`${redirect_uri}?code=123`)}`);
			await got(`${redirect_uri}?code=123`);
		} catch (error) {
			if (error.response) {
				expect(error.response.statusCode).to.equal(400);
			} else {
				throw error;
			}
		} finally {
			await cancel();
		}
	});

	it('should error if requesting non-callback url', async function () {
		this.timeout(10000);

		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(new URL(url).searchParams.get('redirect_uri'));

		try {
			log(`Requesting: ${highlight(redirect_uri.origin)}`);
			await got(redirect_uri.origin);
		} catch (error) {
			if (error.response) {
				expect(error.response.statusCode).to.equal(400);
			} else {
				throw error;
			}
		} finally {
			await cancel();
		}
	});

	it('should reject login when manual login is cancelled', async function () {
		this.timeout(10000);

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
