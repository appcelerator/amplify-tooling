/* eslint-disable no-unused-vars */

import E from '../errors';
import pluralize from 'pluralize';
import snooplogg from 'snooplogg';

const { log } = snooplogg('amplify-auth:token-store');
const { highlight } = snooplogg.styles;

/**
 * A regex to match a URL protocol.
 * @type {RegExp}
 */
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

	/* istanbul ignore next */
	/**
	 * Removes all tokens. This method is intended to be overwritten.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async clear(baseUrl) {
		return { entries: [], removed: [] };
	}

	/**
	 * Removes all tokens.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async _clear(baseUrl) {
		const entries = await this.list();

		if (!baseUrl) {
			for (const entry of entries) {
				Object.defineProperty(entry.auth, 'expired', { value: true });
			}
			return { entries: [], removed: entries };
		}

		const removed = [];
		baseUrl = baseUrl.replace(protoRegExp, '');
		for (let i = 0; i < entries.length; i++) {
			if (entries[i].auth.baseUrl.replace(protoRegExp, '') === baseUrl) {
				const entry = entries.splice(i--, 1)[0];
				Object.defineProperty(entry.auth, 'expired', { value: true });
				removed.push(entry);
			}
		}

		return { entries, removed };
	}

	/* istanbul ignore next */
	/**
	 * Deletes a token from the store. This method is intended to be overwritten.
	 *
	 * @param {String|Array.<String>} accounts - The account name(s) to delete.
 	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise}
	 * @access public
	 */
	async delete(accounts, baseUrl) {
		return [];
	}

	/**
	 * Deletes a token from the store.
	 *
	 * @param {String|Array.<String>} accounts - The account name(s) to delete.
 	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise}
	 * @access public
	 */
	async _delete(accounts, baseUrl) {
		const entries = await this.list();
		const removed = [];

		if (baseUrl) {
			baseUrl = baseUrl.replace(protoRegExp, '');
		}

		if (!Array.isArray(accounts)) {
			accounts = [ accounts ];
		}

		for (let i = 0; i < entries.length; i++) {
			if (accounts.includes(entries[i].name) && (!baseUrl || entries[i].auth.baseUrl.replace(protoRegExp, '') === baseUrl)) {
				const entry = entries.splice(i--, 1)[0];
				Object.defineProperty(entry.auth, 'expired', { value: true });
				removed.push(entry);
			}
		}

		return { entries, removed };
	}

	/**
	 * Retreives a token from the store.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {String} params.accountName - The account name to get.
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise} Resolves the token or `undefined` if not set.
	 * @access public
	 */
	async get({ accountName, baseUrl, hash } = {}) {
		const entries = await this.list();

		if (baseUrl) {
			baseUrl = baseUrl.replace(protoRegExp, '').replace(/\/$/, '');
		}

		if (!accountName && !hash) {
			throw E.MISSING_REQUIRED_PARAMETER('Must specify either the account name or authenticator hash');
		}

		const len = entries.length;
		log(`Scanning ${highlight(len)} ${pluralize('token', len)} for accountName=${highlight(accountName)} hash=${highlight(hash)} baseUrl=${highlight(baseUrl)}`);

		for (let i = 0; i < len; i++) {
			if (((accountName && entries[i].name === accountName) || (hash && entries[i].hash === hash)) && (!baseUrl || entries[i].auth.baseUrl.replace(protoRegExp, '').replace(/\/$/, '') === baseUrl)) {
				log(`Found account tokens: ${highlight(entries[i].name)}`);
				return entries[i];
			}
		}

		log('Token not found');

		return null;
	}

	/**
	 * Retreives all tokens from the store. This method is intended to be overwritten.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	async list() {
		return [];
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

		let count = 0;

		// loop over each entry and remove any expired tokens
		// NOTE: this code intentionally checkes `entries.length` each loop instead of caching the
		// length since splice() shrinks the array length
		for (let i = 0; i < entries.length; i++) {
			const { expires } = entries[i].auth;
			const now = Date.now();
			if (expires && ((expires.access > (now + this.tokenRefreshThreshold)) || (expires.refresh > now))) {
				// not expired
				if (!Object.getOwnPropertyDescriptor(entries[i].auth, 'expired')) {
					Object.defineProperty(entries[i].auth, 'expired', {
						configurable: true,
						get() {
							return this.expires.access < Date.now();
						}
					});
				}
				continue;
			}
			count++;
			entries.splice(i--, 1);
		}

		if (count) {
			log(`Purged ${highlight(count)} ${pluralize('entry', count)}`);
		}

		return entries;
	}

	/* istanbul ignore next */
	/**
	 * Saves account credentials. This method is intended to be overwritten.
	 *
	 * @param {Object} data - The token data.
	 * @returns {Promise}
	 * @access private
	 */
	async set(data) {
		// noop
	}

	/**
	 * Saves account credentials. If exists, the old one is deleted.
	 *
	 * @param {Object} data - The token data.
	 * @returns {Promise}
	 * @access private
	 */
	async _set(data) {
		const entries = await this.list();

		for (let i = 0, len = entries.length; i < len; i++) {
			if (entries[i].auth.baseUrl === data.auth.baseUrl && entries[i].name === data.name) {
				entries.splice(i, 1);
				break;
			}
		}

		entries.push(data);
		return entries;
	}
}
