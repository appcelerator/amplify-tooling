import TokenStore from './token-store';
import { Account } from '../types.js';

/**
 * A operating-specific secure token store.
 */
export default class MemoryStore extends TokenStore {
	/**
	 * The in-memory store.
	 *
	 * @type {Array.<Object>}
	 */
	store: Account[] = [];

	/**
	 * Removes all tokens.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async clear(baseUrl?: string): Promise<Account[]> {
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
	async delete(accounts: string | string[], baseUrl?: string): Promise<Account[]> {
		const { entries, removed } = await super._delete(accounts, baseUrl);
		this.store = entries;
		return removed;
	}

	/**
	 * Retreives all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	async list(): Promise<Account[]> {
		return this.purge(this.store);
	}

	/**
	 * Saves account credentials. If exists, the old one is deleted.
	 *
	 * @param {Object} data - The token data.
	 * @returns {Promise}
	 * @access public
	 */
	async set(data: Account): Promise<void> {
		this.store = await super._set(data);
	}
}
