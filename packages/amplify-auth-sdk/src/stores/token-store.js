/**
 * Base class for token storage backends.
 */
export default class TokenStore {
	/**
	 * Deletes a token from the store.
	 *
	 * @param {String} key - The token key to delete.
	 * @returns {Promise}
	 * @access public
	 */
	async delete(key) {
		//
	}

	/**
	 * Retreives a token from the store.
	 *
	 * @param {String} key - The token key to get.
	 * @returns {Promise} Resolves the token or `undefined` if not set.
	 * @access public
	 */
	async get(key) {
		//
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
		//
	}
}
