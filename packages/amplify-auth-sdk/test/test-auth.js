import Auth, { internal } from '../dist/index';
import fetch from 'node-fetch';
import snooplogg from 'snooplogg';

import { createLoginServer, stopLoginServer } from './common';
import { serverInfo } from './server-info';

const { Authenticator } = internal;

const { log } = snooplogg('test:amplify-auth:auth');

describe('Auth', () => {
	describe('Constructor', () => {
		afterEach(stopLoginServer);

		it('should error if options is invalid', () => {
			expect(() => {
				new Auth();
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if base URL is not specified', () => {
			expect(() => {
				new Auth({
					baseUrl: 123
				});
			}).to.throw(Error, 'Invalid base URL: env or baseUrl required');
		});

		it('should error if client id is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###'
				});
			}).to.throw(TypeError, 'Expected required parameter "clientId" to be a non-empty string');

			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: ''
				});
			}).to.throw(TypeError, 'Expected required parameter "clientId" to be a non-empty string');
		});

		it('should error if access type is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					accessType: 123
				});
			}).to.throw(TypeError, 'Expected parameter "accessType" to be a string');
		});

		it('should error if response type is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					responseType: 123
				});
			}).to.throw(TypeError, 'Expected parameter "responseType" to be a string');
		});

		it('should error if scope is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					scope: 123
				});
			}).to.throw(TypeError, 'Expected parameter "scope" to be a string');
		});

		it('should error if server host is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					serverHost: 123
				});
			}).to.throw(TypeError, 'Expected parameter "serverHost" to be a string');
		});

		it('should error if interactive login timeout is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					interactiveLoginTimeout: 'foo'
				});
			}).to.throw(TypeError, 'Expected interactive login timeout to be a number of milliseconds');

			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					interactiveLoginTimeout: -123
				});
			}).to.throw(RangeError, 'Interactive login timeout must be greater than or equal to zero');
		});

		it('should set the interactive login timeout', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test_client',
				realm: 'test_realm',
				interactiveLoginTimeout: 1234
			});

			expect(auth.authenticator.interactiveLoginTimeout).to.equal(1234);
		});

		it('should error if server port is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					serverPort: 'foo'
				});
			}).to.throw(TypeError, 'Expected server port to be a number between 1024 and 65535');

			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					serverPort: 123
				});
			}).to.throw(RangeError, 'Expected server port to be a number between 1024 and 65535');
		});

		it('should set the server port', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test_client',
				realm: 'test_realm',
				serverPort: 1234
			});

			expect(auth.authenticator.serverPort).to.equal(1234);
		});

		it('should error if token refresh threshold is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					tokenRefreshThreshold: 'foo'
				});
			}).to.throw(TypeError, 'Expected token refresh threshold to be a number of seconds');

			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					tokenRefreshThreshold: -123
				});
			}).to.throw(RangeError, 'Token refresh threshold must be greater than or equal to zero');
		});

		it('should set the token refresh threshold', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 10
			});

			expect(auth.authenticator.tokenRefreshThreshold).to.equal(10000);
		});

		it('should error when overriding endpoints parameter is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					endpoints: 'foo'
				});
			}).to.throw(TypeError, 'Expected endpoints to be an object of names to URLs');
		});

		it('should error when overriding with invalid endpoint URL', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					endpoints: {
						auth: ''
					}
				});
			}).to.throw(TypeError, 'Expected "auth" endpoint URL to be a non-empty string');
		});

		it('should error when overriding invalid endpoint', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					endpoints: {
						foo: 'bar'
					}
				});
			}).to.throw(Error, 'Invalid endpoint "foo"');
		});

		it('should error if messages is not an object', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test_client',
					realm: 'test_realm',
					messages: 'foo'
				});
			}).to.throw(TypeError, 'Expected messages to be an object');
		});

		it('should override a default message with a text string', async function () {
			this.server = await createLoginServer();

			const text = 'It worked!';

			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				messages: {
					interactiveSuccess: text
				}
			});

			let { url } = await auth.login({ headless: true });

			log(`Manually fetching ${url}`);
			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			url = res.headers.get('location');
			log(`Fetching ${url}`);

			res = await fetch(url, {
				headers: {
					Accept: 'text/plain'
				}
			});

			expect(res.status).to.equal(200);
			expect(await res.text()).to.equal(text);
		});

		it('should override a default message with a object and html', async function () {
			this.server = await createLoginServer();

			const html = '<html><body>It worked!!</body></html>';

			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				messages: {
					interactiveSuccess: {
						html,
						text: 'It worked!!'
					}
				}
			});

			const { url } = await auth.login({ headless: true });

			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			res = await fetch(res.headers.get('location'));
			expect(res.status).to.equal(200);
			expect(await res.text()).to.equal(html);
		});

		it('should respond to interactive login as json', async function () {
			this.server = await createLoginServer();

			const text = 'It worked!';

			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				messages: {
					interactiveSuccess: text
				}
			});

			let { url } = await auth.login({ headless: true });

			log(`Manually fetching ${url}`);
			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			url = res.headers.get('location');
			log(`Fetching ${url}`);

			res = await fetch(url, {
				headers: {
					Accept: 'application/json'
				}
			});

			expect(res.status).to.equal(200);
			expect(await res.json()).to.deep.equal({
				message: 'It worked!',
				success: true
			});
		});

		it('should respond to failed interactive login as json', async function () {
			this.server = await createLoginServer();

			const text = 'It worked!';

			const auth = new Auth({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				messages: {
					interactiveSuccess: text
				}
			});

			let { promise, url } = await auth.login({ headless: true });

			promise.catch(() => {});

			log(`Manually fetching ${url}`);
			let res = await fetch(url, {
				redirect: 'manual'
			});
			expect(res.status).to.equal(301);

			url = res.headers.get('location').split('?')[0];
			log(`Fetching ${url}`);

			res = await fetch(url, {
				headers: {
					Accept: 'application/json'
				}
			});

			expect(res.status).to.equal(400);
			expect(await res.json()).to.deep.equal({
				message: 'Invalid auth code',
				success: false
			});
		});
	});

	describe('Environment', () => {
		it('should assign environment specific value', () => {
			const auth = new Auth({
				clientId: 'test_client',
				env: 'dev',
				realm: 'test_realm'
			});

			expect(auth.authenticator.baseUrl).to.equal(Authenticator.Environments.dev.baseUrl);
		});

		it('should error if env is invalid', () => {
			expect(() => {
				new Auth({
					env: 'foo'
				});
			}).to.throw(Error, 'Invalid environment: foo');
		});
	});

	describe('Properties', () => {
		it('should set an optional property', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test_client',
				realm: 'test_realm',
				accessType: 'foo'
			});

			expect(auth.authenticator.accessType).to.equal('foo');
		});

		it('should override endpoint', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test_client',
				realm: 'test_realm',
				endpoints: {
					auth: 'foo'
				}
			});

			expect(auth.authenticator.endpoints.auth).to.equal('foo');
		});
	});

	describe('Server Info', () => {
		afterEach(stopLoginServer);

		it('should fetch server info', async function () {
			this.server = await createLoginServer();

			const info = await Auth.serverInfo('http://127.0.0.1:1337/auth/realms/test_realm/.well-known/openid-configuration');
			expect(info).to.deep.equal(serverInfo);
		});

		it('should throw error if server returns error', async function () {
			this.server = await createLoginServer({
				serverinfo(post, req, res) {
					res.writeHead(500);
					res.end('Server error');
				}
			});

			try {
				await Auth.serverInfo('http://127.0.0.1:1337/auth/realms/test_realm/.well-known/openid-configuration');
			} catch (err) {
				return;
			}

			throw new Error('Expected error to be thrown');
		});

		it('should throw error if server response is invalid', async function () {
			this.server = await createLoginServer({
				serverinfo(post, req, res) {
					res.writeHead(200);
					res.end('{{{{{{{{{{');
				}
			});

			try {
				await Auth.serverInfo('http://127.0.0.1:1337/auth/realms/test_realm/.well-known/openid-configuration');
			} catch (err) {
				return;
			}

			throw new Error('Expected error to be thrown');
		});
	});
});
