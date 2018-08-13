import E from '../errors';
import fs from 'fs-extra';
import path from 'path';
import TokenStore from './token-store';

/**
 * A file-based token store.
 */
export default class FileStore extends TokenStore {
	/**
	 * Initializes the file store.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.tokenStoreFile - The path to the file-based token store.
	 * @access public
	 */
	constructor(opts = {}) {
		super(opts);

		if (!opts.tokenStoreFile || typeof opts.tokenStoreFile !== 'string') {
			throw E.MISSING_REQUIRED_PARAMETER('File token store requires a token store file path');
		}

		this.tokenStoreFile = path.resolve(opts.tokenStoreFile);
	}

	/**
	 * Removes all tokens.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async clear(baseUrl) {
		const { entries, removed } = await super.clear(baseUrl);
		if (entries.length) {
			await fs.outputFile(this.tokenStoreFile, this.encode(entries), { mode: 384 /* 600 */ });
		} else {
			await fs.remove(this.tokenStoreFile);
		}
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
	async delete(accounts, baseUrl) {
		const { entries, removed } = await super.delete(accounts, baseUrl);
		if (entries.length) {
			await fs.outputFile(this.tokenStoreFile, this.encode(entries), { mode: 384 /* 600 */ });
		} else {
			await fs.remove(this.tokenStoreFile);
		}
		return removed;
	}

	/**
	 * Retreives all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	async list() {
		if (fs.existsSync(this.tokenStoreFile)) {
			return this.purge(this.decode(fs.readFileSync(this.tokenStoreFile, 'utf8')));
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
		await fs.outputFile(this.tokenStoreFile, this.encode(entries), { mode: 384 /* 600 */ });
	}
}
