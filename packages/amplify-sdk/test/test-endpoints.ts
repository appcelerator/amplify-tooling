import { getEndpoints } from '../src/index.js';
import { expect } from 'chai';

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

	it('should error setting endpoints if realm is invalid', () => {
		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/'
			});
		}).to.throw(TypeError, 'Expected realm to be a non-empty string');

		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/',
				realm: ''
			});
		}).to.throw(TypeError, 'Expected realm to be a non-empty string');

		expect(() => {
			getEndpoints({
				baseUrl: 'http://localhost/',
				realm: 123
			});
		}).to.throw(TypeError, 'Expected realm to be a non-empty string');
	});

	it('should return the endpoints', () => {
		const endpoints = getEndpoints({
			baseUrl: 'http://localhost/',
			realm: 'test_realm'
		});

		expect(endpoints).to.deep.equal({
			auth:              'http://localhost/auth/realms/test_realm/protocol/openid-connect/auth',
			certs:             'http://localhost/auth/realms/test_realm/protocol/openid-connect/certs',
			logout:            'http://localhost/auth/realms/test_realm/protocol/openid-connect/logout',
			token:             'http://localhost/auth/realms/test_realm/protocol/openid-connect/token',
			userinfo:          'http://localhost/auth/realms/test_realm/protocol/openid-connect/userinfo',
			wellKnown:         'http://localhost/auth/realms/test_realm/.well-known/openid-configuration'
		});
	});
});
