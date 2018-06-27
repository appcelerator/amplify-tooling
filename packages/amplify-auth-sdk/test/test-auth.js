import Auth, { internal } from '../dist/index';
import http from 'http';

import { serverInfo } from './server-info';

const { Authenticator } = internal;

describe('Auth', () => {
	describe('Constructor', () => {
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
					clientId: 'test-client',
					realm: 'test-realm',
					accessType: 123
				});
			}).to.throw(TypeError, 'Expected parameter "accessType" to be a string');
		});

		it('should error if response type is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					responseType: 123
				});
			}).to.throw(TypeError, 'Expected parameter "responseType" to be a string');
		});

		it('should error if scope is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					scope: 123
				});
			}).to.throw(TypeError, 'Expected parameter "scope" to be a string');
		});

		it('should error if server host is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					serverHost: 123
				});
			}).to.throw(TypeError, 'Expected parameter "serverHost" to be a string');
		});

		it('should error if interactive login timeout is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					interactiveLoginTimeout: 'foo'
				});
			}).to.throw(TypeError, 'Expected interactive login timeout to be a number of milliseconds');

			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					interactiveLoginTimeout: -123
				});
			}).to.throw(RangeError, 'Interactive login timeout must be greater than or equal to zero');
		});

		it('should set the interactive login timeout', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test-client',
				realm: 'test-realm',
				interactiveLoginTimeout: 1234
			});

			expect(auth.authenticator.interactiveLoginTimeout).to.equal(1234);
		});

		it('should error if server port is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					serverPort: 'foo'
				});
			}).to.throw(TypeError, 'Expected server port to be a number between 1024 and 65535');

			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					serverPort: 123
				});
			}).to.throw(RangeError, 'Expected server port to be a number between 1024 and 65535');
		});

		it('should set the server port', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test-client',
				realm: 'test-realm',
				serverPort: 1234
			});

			expect(auth.authenticator.serverPort).to.equal(1234);
		});

		it('should error if token refresh threshold is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					tokenRefreshThreshold: 'foo'
				});
			}).to.throw(TypeError, 'Expected token refresh threshold to be a number of seconds');

			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					tokenRefreshThreshold: -123
				});
			}).to.throw(RangeError, 'Token refresh threshold must be greater than or equal to zero');
		});

		it('should set the token refresh threshold', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test-client',
				realm: 'test-realm',
				tokenRefreshThreshold: 10
			});

			expect(auth.authenticator.tokenRefreshThreshold).to.equal(10000);
		});

		it('should error when overriding endpoints parameter is invalid', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
					endpoints: 'foo'
				});
			}).to.throw(TypeError, 'Expected endpoints to be an object of names to URLs');
		});

		it('should error when overriding with invalid endpoint URL', () => {
			expect(() => {
				new Auth({
					baseUrl: '###',
					clientId: 'test-client',
					realm: 'test-realm',
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
					clientId: 'test-client',
					realm: 'test-realm',
					endpoints: {
						foo: 'bar'
					}
				});
			}).to.throw(Error, 'Invalid endpoint "foo"');
		});
	});

	describe('Environment', () => {
		it('should assign environment specific value', () => {
			const auth = new Auth({
				clientId: 'test-client',
				env: 'dev',
				realm: 'test-realm'
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
				clientId: 'test-client',
				realm: 'test-realm',
				accessType: 'foo'
			});

			expect(auth.authenticator.accessType).to.equal('foo');
		});

		it('should override endpoint', () => {
			const auth = new Auth({
				baseUrl: '###',
				clientId: 'test-client',
				realm: 'test-realm',
				endpoints: {
					auth: 'foo'
				}
			});

			expect(auth.authenticator.endpoints.auth).to.equal('foo');
		});
	});

	describe('Server Info', () => {
		afterEach(async function () {
			if (this.server) {
				await new Promise(resolve => {
					this.server.close(() => {
						this.server = null;
						resolve();
					});
				});
			}
		});

		it('should fetch server info', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(serverInfo));
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const info = await Auth.serverInfo('http://127.0.0.1:1337/');
			expect(info).to.deep.equal(serverInfo);
		});

		it('should throw error if server returns error', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(500);
				res.end('Server error');
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			try {
				await Auth.serverInfo('http://127.0.0.1:1337/');
			} catch (err) {
				return;
			}

			throw new Error('Expected error to be thrown');
		});

		it('should throw error if server response is invalid', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(200);
				res.end('{{{{{{{{{{');
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			try {
				await Auth.serverInfo('http://127.0.0.1:1337/');
			} catch (err) {
				return;
			}

			throw new Error('Expected error to be thrown');
		});
	});
});
