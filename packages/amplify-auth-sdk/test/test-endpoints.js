import { getEndpoints } from '../dist/index';

describe('Endpoints', () => {
	it('should error setting endpoints if baseUrl is invalid', () => {
		expect(() => {
			getEndpoints();
		}).to.throw(TypeError, 'Expected baseUrl to be a non-empty string');

		expect(() => {
			getEndpoints({});
		}).to.throw(TypeError, 'Expected baseUrl to be a non-empty string');

		expect(() => {
			getEndpoints({
				baseUrl: ''
			});
		}).to.throw(TypeError, 'Expected baseUrl to be a non-empty string');

		expect(() => {
			getEndpoints({
				baseUrl: 123
			});
		}).to.throw(TypeError, 'Expected baseUrl to be a non-empty string');
	});

	it('should error setting endpoints if platformUrl is invalid', () => {
		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/',
				platformUrl: {}
			});
		}).to.throw(TypeError, 'Expected platformUrl to be a non-empty string');

		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/',
				platformUrl: 123
			});
		}).to.throw(TypeError, 'Expected platformUrl to be a non-empty string');
	});

	it('should error setting endpoints if realm is invalid', () => {
		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/',
				platformUrl: 'http://localhost/'
			});
		}).to.throw(TypeError, 'Expected realm to be a non-empty string');

		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/',
				platformUrl: 'http://localhost/',
				realm: ''
			});
		}).to.throw(TypeError, 'Expected realm to be a non-empty string');

		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/',
				platformUrl: 'http://localhost/',
				realm: 123
			});
		}).to.throw(TypeError, 'Expected realm to be a non-empty string');
	});

	it('should return the endpoints with a platformUrl', () => {
		const endpoints = getEndpoints({
			baseUrl: 'http://localhost/',
			platformUrl: 'http://localhost/',
			realm: 'test_realm'
		});

		expect(endpoints).to.deep.equal({
			auth:              'http://localhost/auth/realms/test_realm/protocol/openid-connect/auth',
			certs:             'http://localhost/auth/realms/test_realm/protocol/openid-connect/certs',
			findSession:       'http://localhost/api/v1/auth/findSession',
			logout:            'http://localhost/auth/realms/test_realm/protocol/openid-connect/logout',
			switchLoggedInOrg: 'http://localhost/api/v1/auth/switchLoggedInOrg',
			token:             'http://localhost/auth/realms/test_realm/protocol/openid-connect/token',
			userinfo:          'http://localhost/auth/realms/test_realm/protocol/openid-connect/userinfo',
			wellKnown:         'http://localhost/auth/realms/test_realm/.well-known/openid-configuration'
		});
	});

	it('should return the endpoints without a platformUrl', () => {
		const endpoints = getEndpoints({
			baseUrl: 'http://localhost/',
			realm: 'test_realm'
		});

		expect(endpoints).to.deep.equal({
			auth:              'http://localhost/auth/realms/test_realm/protocol/openid-connect/auth',
			certs:             'http://localhost/auth/realms/test_realm/protocol/openid-connect/certs',
			findSession:       undefined,
			logout:            'http://localhost/auth/realms/test_realm/protocol/openid-connect/logout',
			switchLoggedInOrg: undefined,
			token:             'http://localhost/auth/realms/test_realm/protocol/openid-connect/token',
			userinfo:          'http://localhost/auth/realms/test_realm/protocol/openid-connect/userinfo',
			wellKnown:         'http://localhost/auth/realms/test_realm/.well-known/openid-configuration'
		});
	});
});
