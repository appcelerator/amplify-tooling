/* eslint-disable no-unused-vars */

import E from '../errors';
import zlib from 'zlib';

/**
 * Base class for token storage backends.
 */
export default class TokenStore {
	/**
	 * The age in milliseconds before the access token expires and should be refreshed.
	 *
	 * @type {Number}
	 * @access private
	 */
	tokenRefreshThreshold = 0;

	/**
	 * Initializes the file store.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.tokenRefreshThreshold=0] - The number of seconds before the access
	 * token expires and should be refreshed.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (opts.hasOwnProperty('tokenRefreshThreshold')) {
			const threshold = parseInt(opts.tokenRefreshThreshold, 10);
			if (isNaN(threshold)) {
				throw E.INVALID_PARAMETER('Expected token refresh threshold to be a number of seconds');
			}

			if (threshold < 0) {
				throw E.INVALID_RANGE('Token refresh threshold must be greater than or equal to zero');
			}

			this.tokenRefreshThreshold = threshold * 1000;
		}
	}

	/**
	 * Decodes the supplied string into an object.
	 *
	 * @param {String} str - The string to decode into an object.
	 * @returns {Object}
	 * @access private
	 */
	decode(str) {
		const data = JSON.parse(zlib.unzipSync(Buffer.from(str, 'base64')));
		const tokens = data && data.tokens;

		if (tokens && tokens.access_token && tokens.refresh_token) {
			const expires = data && data.expires;
			const now = Date.now();
			if ((expires.access > (now + this.tokenRefreshThreshold)) || (expires.refresh > now)) {
				return data;
			}
		}

		throw new Error('Invalid or expired tokens');
	}

	/**
	 * Deletes a token from the store.
	 *
	 * @param {String} key - The token key to delete.
	 * @returns {Promise}
	 * @access public
	 */
	async delete(key) {
		// noop
	}

	/**
	 * Encodes an object into a string.
	 *
	 * @param {Object} data - The object to encode into a string.
	 * @returns {String}
	 * @access private
	 */
	encode(data) {
		return zlib.deflateSync(JSON.stringify(data)).toString('base64');
	}

	/**
	 * Retreives a token from the store.
	 *
	 * @param {String} key - The token key to get.
	 * @returns {Promise} Resolves the token or `undefined` if not set.
	 * @access public
	 */
	async get(key) {
		// noop
	}

	/**
	 * Retreives all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	async list() {
		// noop
	}

	/**
	 * Retreives a token from the store.
	 *
	 * @param {String} key - The token key to get.
	 * @param {Object} data - The token data.
	 * @returns {Promise}
	 * @access public
	 */
	async set(key, data) {
		// noop
	}
}
