import { Authenticator } from '../dist/index';

describe('Authenticator', () => {
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

		it('should error if tokenStore is not a TokenStore', () => {
			expect(() => {
				new Authenticator({
					baseUrl:    'http://127.0.0.1:1337',
					clientId:    'test_client',
					realm:       'test_realm',
					tokenStore:  'foo'
				});
			}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');

			expect(() => {
				new Authenticator({
					baseUrl:     'http://127.0.0.1:1337',
					clientId:    'test_client',
					realm:       'test_realm',
					tokenStore:  {}
				});
			}).to.throw(TypeError, 'Expected the token store to be a "TokenStore" instance');
		});
	});
});
