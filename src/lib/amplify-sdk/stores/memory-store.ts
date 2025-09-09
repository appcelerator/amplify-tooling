import TokenStore from './token-store.js';

/**
 * A operating-specific secure token store.
 */
export default class MemoryStore extends TokenStore {
	/**
	 * The in-memory store.
	 *
	 * @type {Array.<Object>}
	 */
	store = [];

	/**
	 * Removes all tokens.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	override async clear(baseUrl) {
		const { entries, removed } = await super._clear(baseUrl);
		this.store = entries;
		return removed;
	}

	/**
	 * Deletes a token from the store.
	 *
	 * @param {String|Array.<String>} accounts - The account name(s) to delete.
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	override async delete(accounts, baseUrl) {
		const { entries, removed } = await super._delete(accounts, baseUrl);
		this.store = entries;
		return removed;
	}

	/**
	 * Retrieves all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	override async list() {
		return this.purge(this.store);
	}

	/**
	 * Saves account credentials. If exists, the old one is deleted.
	 *
	 * @param {Object} data - The token data.
	 * @returns {Promise}
	 * @access public
	 */
	override async set(data) {
		this.store = await super._set(data);
	}
}
