/* eslint-disable no-unused-vars */

import E from '../errors';
import zlib from 'zlib';

const protoRegExp = /^.*\/\//;

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

		if (opts.tokenRefreshThreshold !== undefined) {
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
	 * Removes all tokens.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async clear(baseUrl) {
		const entries = await this.list();

		if (!baseUrl) {
			return { entries: [], removed: entries };
		}

		const removed = [];
		baseUrl = baseUrl.replace(/^.*\/\//, '');
		for (let i = 0; i < entries.length; i++) {
			if (entries[i].baseUrl.replace(protoRegExp, '') === baseUrl) {
				removed.push.apply(removed, entries.splice(i--, 1));
			}
		}

		return { entries, removed };
	}

	/**
	 * Decodes the supplied string into an object.
	 *
	 * @param {String} str - The string to decode into an object.
	 * @returns {Object}
	 * @access private
	 */
	decode(str) {
		return JSON.parse(zlib.unzipSync(Buffer.from(str, 'base64')));
	}

	/**
	 * Deletes a token from the store.
	 *
	 * @param {String|Array.<String>} accounts - The account name(s) to delete.
 	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise}
	 * @access public
	 */
	async delete(accounts, baseUrl) {
		const entries = await this.list();
		const removed = [];

		if (baseUrl) {
			baseUrl = baseUrl.replace(/^.*\/\//, '');
		}

		if (!Array.isArray(accounts)) {
			accounts = [ accounts ];
		}

		for (let i = 0; i < entries.length; i++) {
			if (accounts.includes(entries[i].email) && (!baseUrl || entries[i].baseUrl.replace(protoRegExp, '') === baseUrl)) {
				removed.push.apply(removed, entries.splice(i--, 1));
			}
		}

		return { entries, removed };
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
	 * @param {String} email - The account name to get.
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise} Resolves the token or `undefined` if not set.
	 * @access public
	 */
	async get(email, baseUrl) {
		const entries = await this.list();

		if (baseUrl) {
			baseUrl = baseUrl.replace(protoRegExp, '');
		}

		for (let i = 0, len = entries.length; i < len; i++) {
			if (entries[i].email === email && (!baseUrl || entries[i].baseUrl.replace(protoRegExp, '') === baseUrl)) {
				return entries[i];
			}
		}

		return null;
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
	 * Ensures list of tokens is valid and does not contain any expired tokens.
	 *
	 * @param {Array.<Object>} entries - An array of tokens.
	 * @returns {Array.<Object>}
	 * @access private
	 */
	purge(entries) {
		if (!entries) {
			return [];
		}

		for (let i = 0; i < entries.length; i++) {
			const { email, expires, tokens } = entries[i];
			if (expires && tokens && tokens.access_token && tokens.refresh_token) {
				const now = Date.now();
				if ((expires.access > (now + this.tokenRefreshThreshold)) || (expires.refresh > now)) {
					// not expired
					continue;
				}
			}
			entries.splice(i--, 1);
		}

		return entries;
	}

	/**
	 * Saves account credentials. If exists, the old one is deleted.
	 *
	 * @param {Object} data - The token data.
	 * @returns {Promise}
	 * @access private
	 */
	async set(data) {
		const entries = await this.list();

		for (let i = 0, len = entries.length; i < len; i++) {
			if (entries[i].baseUrl === data.baseUrl && entries[i].email === data.email) {
				entries.splice(i, 1);
				break;
			}
		}

		entries.push(data);
		return entries;
	}
}
