import { Authenticator } from '../dist/index';

describe('Auth', () => {
	describe('Constructor', () => {
		it('should error if options is invalid', () => {
			expect(() => {
				new Authenticator('foo');
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if base URL is not specified', () => {
			expect(() => {
				new Authenticator({});
			}).to.throw(Error, 'Invalid base URL: env or baseUrl required');
		});

		it('should error if base URL is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 123
				});
			}).to.throw(Error, 'Invalid base URL: env or baseUrl required');
		});

		it('should error if client id is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337'
				});
			}).to.throw(TypeError, 'Expected required parameter "clientId" to be a non-empty string');

			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: ''
				});
			}).to.throw(TypeError, 'Expected required parameter "clientId" to be a non-empty string');
		});

		it('should error if access type is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					accessType: 123
				});
			}).to.throw(TypeError, 'Expected parameter "accessType" to be a string');
		});

		it('should error if response type is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					responseType: 123
				});
			}).to.throw(TypeError, 'Expected parameter "responseType" to be a string');
		});

		it('should error if scope is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					scope: 123
				});
			}).to.throw(TypeError, 'Expected parameter "scope" to be a string');
		});

		it('should error if server host is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					serverHost: 123
				});
			}).to.throw(TypeError, 'Expected parameter "serverHost" to be a string');
		});

		it('should set the server host', () => {
			const auth = new Authenticator({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				serverHost: 'foo'
			});

			expect(auth.serverHost).to.equal('foo');
		});

		it('should error if interactive login timeout is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					interactiveLoginTimeout: 'foo'
				});
			}).to.throw(TypeError, 'Expected interactive login timeout to be a number of milliseconds');

			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					interactiveLoginTimeout: -123
				});
			}).to.throw(RangeError, 'Interactive login timeout must be greater than or equal to zero');
		});

		it('should set the interactive login timeout', () => {
			const auth = new Authenticator({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				interactiveLoginTimeout: 1234
			});

			expect(auth.interactiveLoginTimeout).to.equal(1234);
		});

		it('should error if server port is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					serverPort: 'foo'
				});
			}).to.throw(TypeError, 'Expected server port to be a number between 1024 and 65535');

			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					serverPort: 123
				});
			}).to.throw(RangeError, 'Expected server port to be a number between 1024 and 65535');
		});

		it('should set the server port', () => {
			const auth = new Authenticator({
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				serverPort: 1234
			});

			expect(auth.serverPort).to.equal(1234);
		});

		it('should error when overriding endpoints parameter is invalid', () => {
			expect(() => {
				new Authenticator({
					baseUrl: 'http://127.0.0.1:1337',
					clientId: 'test_client',
					realm: 'test_realm',
					endpoints: 'foo'
				});
			}).to.throw(TypeError, 'Expected endpoints to be an object of names to URLs');
		});

		it('should error when overriding with invalid endpoint URL', () => {
			expect(() => {
				new Authenticator({
					baseUrl:        'http://127.0.0.1:1337',
					clientId:       'test_client',
					realm:          'test_realm',
					tokenStoreType: null,
					endpoints: {
						auth: ''
					}
				});
			}).to.throw(TypeError, 'Expected "auth" endpoint URL to be a non-empty string');
		});

		it('should error when overriding invalid endpoint', () => {
			expect(() => {
				new Authenticator({
					baseUrl:        'http://127.0.0.1:1337',
					clientId:       'test_client',
					realm:          'test_realm',
					tokenStoreType: null,
					endpoints: {
						foo: 'bar'
					}
				});
			}).to.throw(Error, 'Invalid endpoint "foo"');
		});

		it('should override a specific endpoint', () => {
			const auth = new Authenticator({
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				endpoints: {
					auth: 'bar'
				}
			});

			expect(auth.endpoints.auth).to.equal('bar');
		});

		it('should error if messages is not an object', () => {
			expect(() => {
				new Authenticator({
					baseUrl:        'http://127.0.0.1:1337',
					clientId:       'test_client',
					realm:          'test_realm',
					tokenStoreType: null,
					messages:       'foo'
				});
			}).to.throw(TypeError, 'Expected messages to be an object');
		});
	});
});
