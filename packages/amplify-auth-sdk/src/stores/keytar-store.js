import E from '../errors';
import TokenStore from './token-store';

const protoRegExp = /^.*\/\//;

/**
 * A operating-specific secure token store.
 */
export default class KeytarStore extends TokenStore {
	/**
	 * Loads the `keytar` library.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.keytarServiceName="Axway amplify-auth-sdk"] - The name of the consumer
	 * using this library when using the "keytar" token store.
	 * @access public
	 */
	constructor(opts = {}) {
		super(opts);

		try {
			this.keytar = require('keytar');
		} catch (e) {
			/* istanbul ignore next */
			throw E.KEYTAR_NOT_FOUND('"keytar" package not found, is it installed?');
		}

		this.service = opts.keytarServiceName || 'Axway amplify-auth-sdk';
	}

	/**
	 * Deletes a token from the store.
	 *
	 * @param {String} email - The account name to delete.
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Boolean>}
	 * @access public
	 */
	async delete(email, baseUrl) {
		const entries = await this.list();

		if (baseUrl) {
			baseUrl = baseUrl.replace(/^.*\/\//, '');
		}

		for (let i = 0; i < entries.length; i++) {
			if (entries[i].email === email && (!baseUrl || entries[i].baseUrl.replace(protoRegExp, '') === baseUrl)) {
				entries.splice(i--, 1);
			}
		}

		if (entries.length) {
			await this.keytar.setPassword(this.service, this.service, this.encode(entries));
		} else {
			await this.keytar.deletePassword(this.service, this.service);
		}
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
	 * @returns {Promise<Object>} Resolves an array of tokens.
	 * @access public
	 */
	async list() {
		const entries = await this.keytar.getPassword(this.service, this.service);
		try {
			return this.purge(entries && this.decode(entries));
		} catch (e) {
			await this.keytar.deletePassword(this.service, this.service);
		}
		return [];
	}

	/**
	 * Saves account credentials. If exists, the old one is deleted.
	 *
	 * @param {Object} data - The token data.
	 * @returns {Promise}
	 * @access public
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

		await this.keytar.setPassword(this.service, this.service, this.encode(entries));
	}
}
