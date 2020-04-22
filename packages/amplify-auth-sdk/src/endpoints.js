import E from './errors';

/**
 * Constructs all endpoints.
 *
 * @param {Object} params - Required parameters.
 * @param {String} params.baseUrl - The base URL.
 * @param {String} [params.platformUrl] - The platform URL.
 * @param {String} params.realm - The authentication realm.
 * @returns {Object}
 */
export default function getEndpoints({ baseUrl, platformUrl, realm } = {}) {
	if (!baseUrl || typeof baseUrl !== 'string') {
		throw E.INVALID_ARGUMENT('Expected baseUrl to be a non-empty string');
	}

	if (platformUrl && typeof platformUrl !== 'string') {
		throw E.INVALID_ARGUMENT('Expected platformUrl to be a non-empty string');
	}

	if (!realm || typeof realm !== 'string') {
		throw E.INVALID_ARGUMENT('Expected realm to be a non-empty string');
	}

	// strip the trailing slashes
	baseUrl = baseUrl.replace(/\/$/, '');

	return {
		auth:      `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/auth`,
		certs:     `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/certs`,
		logout:    `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/logout`,
		token:     `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/token`,
		userinfo:  `${baseUrl}/auth/realms/${realm}/protocol/openid-connect/userinfo`,
		wellKnown: `${baseUrl}/auth/realms/${realm}/.well-known/openid-configuration`
	};
}
