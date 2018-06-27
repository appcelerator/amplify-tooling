/* eslint-disable max-len */

import Auth from '../dist/index';
import jws from 'jws';

import { createLoginServer } from './common';

const isCI = process.env.CI || process.env.JENKINS;

describe('PKCE', () => {
	describe('Login', () => {
		afterEach(async function () {
			if (this.server) {
				await this.server.destroy();
				this.server = null;
			}
		});

		it('should retrieve a URL for an interactive headless flow', async () => {
			const auth = new Auth({
				baseUrl: '<URL>',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			const { url } = await auth.login({ headless: true });
			expect(url).to.match(/^<URL>\/auth\/realms\/test_realm\/protocol\/openid-connect\/auth\?access_type=offline&client_id=test_client&code_challenge=.+&code_challenge_method=S256&grant_type=authorization_code&redirect_uri=http%3A%2F%2F127\.0\.0\.1%3A3000%2Fcallback&response_type=code&scope=openid$/);
		});

		it('should authenticate using code', async function () {
			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test'
			});

			this.server = await createLoginServer({
				accessToken
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const result = await auth.authenticator.getToken('foo');
			expect(result).to.equal(accessToken);

			expect(auth.authenticator.email).to.equal('foo@bar.com');

			const expires = auth.expiresIn;
			expect(expires).to.not.be.null;
			const target = Date.now() + 10000;
			expect(expires).to.be.within(target - 100, target + 100);
		});

		it('should timeout during interactive login', async function () {
			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test'
			});

			this.server = await createLoginServer({
				accessToken
			});

			try {
				await auth.login({ timeout: 100 });
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication timed out');
				expect(e.toString()).to.equal('ERR_AUTH_TIMEOUT');
				return;
			}

			throw new Error('Expected error');
		});

		(isCI ? it.skip : it)('should do interactive login', async function () {
			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test'
			});

			this.server = await createLoginServer({
				accessToken
			});

			const result = await auth.login();
			expect(result.accessToken).to.equal(accessToken);
		});
	});

	describe('User Info', () => {
		it('should get user info', async () => {
			const auth = new Auth({
				baseUrl: '<URL>',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			// const info = await auth.userInfo();
			// console.log(info);
		});
	});
});
