import E from './errors.js';

/**
 * Constructs all endpoints.
 *
 * @param {Object} params - Required parameters.
 * @param {String} params.baseUrl - The base URL.
 * @param {String} params.realm - The authentication realm.
 * @returns {Object}
 */
export default function getEndpoints({ baseUrl, realm } = {} as any) {
	if (!baseUrl || typeof baseUrl !== 'string') {
		throw E.INVALID_ARGUMENT('Expected baseUrl to be a non-empty string');
	}

	if (!realm || typeof realm !== 'string') {
		throw E.INVALID_ARGUMENT('Expected realm to be a non-empty string');
	}

	// strip the trailing slashes
	baseUrl = baseUrl.replace(/\/$/, '');

	return {
		auth:      `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/auth`,
		certs:     `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/certs`,
		token:     `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/token`,
		userinfo:  `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/userinfo`,
		wellKnown: `${baseUrl}/auth/realms/${realm}/.well-known/openid-configuration`
	};
}
