import got from 'got';
import { Auth } from '../dist/index';
import snooplogg from 'snooplogg';

const { log } = snooplogg('test:amplify-sdk:server');
const { highlight } = snooplogg.styles;

describe('Server', () => {
	it('should error if callback does not have an auth code', async function () {
		this.timeout(10000);

		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			platformUrl: 'http://127.0.0.1:1337',
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
			platformUrl: 'http://127.0.0.1:1337',
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
			platformUrl: 'http://127.0.0.1:1337',
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
			baseUrl: 'http://localhost:1337',
			clientId: 'test_client',
			platformUrl: 'http://127.0.0.1:1337',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel, loginAccount, url } = await auth.login({ manual: true });
		const redirect_uri = new URL(url).searchParams.get('redirect_uri');
		const redirectUrl = `${redirect_uri}?code=123`;

		// squeltch unhandled rejections
		loginAccount.catch(() => {});

		try {
			log(`Requesting: ${highlight(redirectUrl)}`);
			await got(redirectUrl);
			throw new Error('Expected request to fail');
		} catch (error) {
			if (error.response) {
				expect(error.response.statusCode).to.equal(400);
				return;
			}
			log(`Request failed: ${highlight(redirectUrl)}`);
			throw error;
		} finally {
			log('Cancelling request...');
			await cancel();
		}
	});

	it('should error if requesting non-callback url', async function () {
		this.timeout(10000);

		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			platformUrl: 'http://127.0.0.1:1337',
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
			platformUrl: 'http://127.0.0.1:1337',
			realm: 'test_realm',
			tokenStoreType: null
		});

		const { cancel, loginAccount } = await auth.login({ manual: true });

		await cancel();

		expect(loginAccount).to.eventually.be.rejectedWith(Error, 'Expected promise to be rejected with server stopped error');
	});
});
