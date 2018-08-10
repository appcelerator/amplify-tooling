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
	 * @param {String} key - The token key to delete.
	 * @returns {Promise<Boolean>}
	 * @access public
	 */
	async delete(key) {
		return await this.keytar.deletePassword(this.service, key);
	}

	/**
	 * Retreives a token from the store.
	 *
	 * @param {String} key - The token key to get.
	 * @returns {Promise} Resolves the token or `undefined` if not set.
	 * @access public
	 */
	async get(key) {
		const token = await this.keytar.getPassword(this.service, key);
		try {
			return this.decode(token);
		} catch (e) {
			await this.delete(key);
		}
	}

	/**
	 * Retreives all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	async list() {
		const tokens = [];
		for (const token of await this.keytar.findCredentials(this.service)) {
			try {
				tokens.push.apply(tokens, this.decode(token.password));
			} catch (e) {
				await this.delete(token.account);
			}
		}
		return tokens;
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
		await this.keytar.setPassword(this.service, key, this.encode(data));
	}
}
