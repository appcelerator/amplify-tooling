import crypto from 'crypto';
import E from '../errors.js';
import fs from 'fs';
import path from 'path';
import snooplogg from 'snooplogg';
import TokenStore from './token-store.js';
import { writeFileSync } from '../../fs.js';

const { log, warn } = snooplogg('amplify-sdk:auth:file-store');
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
const iv = Buffer.alloc(16);

/**
 * A file-based token store.
 */
export default class FileStore extends TokenStore {
	/**
	 * The name of the token store file.
	 * @type {String}
	 */
	filename = '.tokenstore.v2';

	homeDir: string;
	tokenStoreDir: string;
	tokenStoreFile: string;
	_key?: any;

	/**
	 * Initializes the file store.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.homeDir - The path to the home directory containing.
	 * @param {String} [opts.tokenStoreDir] - DEPRECATED. The path to the file-based token store.
	 * Use `opts.homeDir` instead.
	 * @access public
	 */
	constructor(opts: any = {}) {
		super(opts);

		let { homeDir, tokenStoreDir } = opts;
		if (!homeDir || typeof homeDir !== 'string') {
			if (tokenStoreDir && typeof tokenStoreDir === 'string') {
				homeDir = tokenStoreDir;
			} else {
				throw E.MISSING_REQUIRED_PARAMETER('Token store requires a home directory');
			}
		}

		this.homeDir = path.resolve(homeDir);

		this.tokenStoreDir = path.join(this.homeDir, 'axway-cli');
		this.tokenStoreFile = path.join(this.tokenStoreDir, this.filename);
	}

	/**
	 * Removes all tokens.
	 *
	 * @param {String} [baseUrl] - The base URL used to filter accounts.
	 * @returns {Promise<Array>}
	 * @access public
	 */
	override async clear(baseUrl): Promise<any> {
		const { entries, removed } = await super._clear(baseUrl);
		if (entries.length) {
			await this.save(entries);
		} else {
			await this.remove();
		}
		return removed;
	}

	/**
	 * Decodes the supplied string into an object.
	 *
	 * @param {String} str - The string to decode into an object.
	 * @returns {Array}
	 * @access private
	 */
	async decode(str) {
		let decipher;
		try {
			decipher = crypto.createDecipheriv(algorithm, await this.getKey(), iv);
		} catch (e) {
			e.amplifyCode = 'ERR_BAD_KEY';
			throw e;
		}

		try {
			return JSON.parse(decipher.update(str, 'hex', 'utf8') + decipher.final('utf8'));
		} catch (e) {
			// it's possible that there was a tokenstore on disk that was encrypted with an old key
			// that no longer exists and the new key can't decode it, so just nuke the tokenstore
			await this.remove();
			throw e;
		}
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
		if (entries.length) {
			await this.save(entries);
		} else {
			await this.remove();
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
		let cipher;
		try {
			cipher = crypto.createCipheriv(algorithm, await this.getKey(), iv);
		} catch (e) {
			e.amplifyCode = 'ERR_BAD_KEY';
			throw e;
		}
		return cipher.update(JSON.stringify(data), 'utf8', 'hex') + cipher.final('hex');
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
				value: 'd4be0906bc9fae40'
			});
		}
		return this._key;
	}

	/**
	 * Retrieves all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	override async list() {
		if (fs.existsSync(this.tokenStoreFile)) {
			try {
				log(`Reading ${highlight(this.tokenStoreFile)}`);
				const entries = await this.decode(fs.readFileSync(this.tokenStoreFile, 'utf8'));
				const validEntries = this.purge(entries);
				if (validEntries.length < entries.length) {
					// something was purged, update the token store
					await this.save(validEntries);
				}
				return validEntries;
			} catch (e) {
				// the decode failed (or there was a keytar problem), so just log a warning and
				// return an empty result
				warn(e);
			}
		}
		return [];
	}

	/**
	 * Removes both v1 and v2 token store files.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async remove() {
		for (let ver = 1; ver <= 2; ver++) {
			const file = ver === 2 ? this.tokenStoreFile : path.join(this.homeDir, this.filename.replace(/\.v2$/, ''));
			log(`Removing ${highlight(file)}`);
			fs.rmSync(file, { force: true });
		}
	}

	/**
	 * Saves the entires to both v1 and v2 token store files.
	 *
	 * @param {Array} entries - The list of entries.
	 * @returns {Promise}
	 * @access private
	 */
	async save(entries) {
		// Auth SDK v2 changed the structure of the data in the token store, but some dependencies
		// still rely on Auth SDK v1's structure. We can't change force them to update and we can't
		// change the structure, so we have to write two versions of the token store. v2 is written
		// as is, but for v1, the data is translated into Auth SDK v1's structure.
		for (let ver = 1; ver <= 2; ver++) {
			const data = await this.encode(ver === 2 ? entries : entries.map(acct => {
				const v1 = {
					...acct,
					...acct.auth,
					org: {
						...acct.org,
						org_id: acct.org?.id
					},
					orgs: !Array.isArray(acct.orgs) ? [] : acct.orgs.map(org => {
						const o = { ...org, org_id: org.id };
						delete o.id;
						return o;
					})
				};

				delete v1.auth;
				delete v1.org.id;

				return v1;
			}));
			const file = ver === 2 ? this.tokenStoreFile : path.join(this.homeDir, this.filename.replace(/\.v2$/, ''));
			log(`Writing ${highlight(file)}`);
			writeFileSync(file, data, { mode: 0o600 });
		}
	}

	/**
	 * Saves account credentials. If exists, the old one is deleted.
	 *
	 * @param {Object} obj - The token data.
	 * @returns {Promise}
	 * @access public
	 */
	override async set(obj) {
		await this.save(await super._set(obj));
	}
}
