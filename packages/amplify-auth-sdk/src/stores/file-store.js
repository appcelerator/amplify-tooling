import crypto from 'crypto';
import E from '../errors';
import fs from 'fs-extra';
import path from 'path';
import snooplogg from 'snooplogg';
import TokenStore from './token-store';

const { log } = snooplogg('amplify-auth:file-store');
const { highlight } = snooplogg.styles;

/**
 * The algorithm for encrypting and decrypting.
 * @type {String}
 */
const algorithm = 'aes-128-cbc';

/**
 * The initialization vector for encrypting and decrypting.
 * @type {Buffer}
 */
const iv = new Buffer.alloc(16);

/**
 * A file-based token store.
 */
export default class FileStore extends TokenStore {
	/**
	 * The name of the token store file.
	 * @type {String}
	 */
	filename = '.tokenstore';

	/**
	 * Initializes the file store.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.tokenStoreDir - The path to the file-based token store.
	 * @access public
	 */
	constructor(opts = {}) {
		super(opts);

		if (!opts.tokenStoreDir || typeof opts.tokenStoreDir !== 'string') {
			throw E.MISSING_REQUIRED_PARAMETER('Token store requires a token store path');
		}

		this.tokenStoreDir = path.resolve(opts.tokenStoreDir);
		this.tokenStoreFile = path.join(this.tokenStoreDir, this.filename);
	}

	/**
	 * Gets the decipher key or generates a new one if it doesn't exist.
	 *
	 * @returns {Buffer}
	 * @access private
	 */
	async getKey() {
		if (!this._key) {
			Object.defineProperty(this, '_key', {
				value: crypto
					.createHash('sha256')
					.update(fs.readFileSync(__filename))
					.digest('hex')
					.slice(0, 16)
			});
		}
		return this._key;
	}

	/**
	 * Removes all tokens.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	async clear(baseUrl) {
		const { entries, removed } = await super._clear(baseUrl);
		if (entries.length) {
			const data = await this.encode(entries);
			await fs.outputFile(this.tokenStoreFile, data, { mode: 384 /* 600 */ });
		} else {
			log(`Deleting empty token file: ${highlight(this.tokenStoreFile)}`);
			await fs.remove(this.tokenStoreFile);
		}
		return removed;
	}

	/**
	 * Decodes the supplied string into an object.
	 *
	 * @param {String} str - The string to decode into an object.
	 * @returns {Object}
	 * @access private
	 */
	async decode(str) {
		const decipher = crypto.createDecipheriv(algorithm, await this.getKey(), iv);
		return JSON.parse(decipher.update(str, 'hex', 'utf8') + decipher.final('utf8'));
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
		const { entries, removed } = await super._delete(accounts, baseUrl);
		if (entries.length) {
			const data = await this.encode(entries);
			await fs.outputFile(this.tokenStoreFile, data, { mode: 384 /* 600 */ });
		} else {
			log(`Deleting empty token file: ${highlight(this.tokenStoreFile)}`);
			await fs.remove(this.tokenStoreFile);
		}
		return removed;
	}

	/**
	 * Encodes an object into a string.
	 *
	 * @param {Object} data - The object to encode into a string.
	 * @returns {String}
	 * @access private
	 */
	async encode(data) {
		const cipher = crypto.createCipheriv(algorithm, await this.getKey(), iv);
		return cipher.update(JSON.stringify(data), 'utf8', 'hex') + cipher.final('hex');
	}

	/**
	 * Retreives all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	async list() {
		if (fs.existsSync(this.tokenStoreFile)) {
			const entries = await this.decode(fs.readFileSync(this.tokenStoreFile, 'utf8'));
			return this.purge(entries);
		}
		return [];
	}

	/**
	 * Saves account credentials. If exists, the old one is deleted.
	 *
	 * @param {Object} obj - The token data.
	 * @returns {Promise}
	 * @access public
	 */
	async set(obj) {
		const entries = await super._set(obj);
		const data = await this.encode(entries);
		await fs.outputFile(this.tokenStoreFile, data, { mode: 384 /* 600 */ });
	}
}
