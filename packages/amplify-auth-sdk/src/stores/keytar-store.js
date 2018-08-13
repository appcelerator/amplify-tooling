import E from '../errors';
import TokenStore from './token-store';

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
	 * @returns {Promise}
	 * @access public
	 */
	async delete(email, baseUrl) {
		const entries = await super.delete(email, baseUrl);
		if (entries.length) {
			await this.keytar.setPassword(this.service, this.service, this.encode(entries));
		} else {
			await this.keytar.deletePassword(this.service, this.service);
		}
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
		const entries = await super.set(data);
		await this.keytar.setPassword(this.service, this.service, this.encode(entries));
	}
}
