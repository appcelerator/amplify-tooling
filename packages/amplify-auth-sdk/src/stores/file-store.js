import crypto from 'crypto';
import E from '../errors';
import fs from 'fs-extra';
import path from 'path';
import snooplogg from 'snooplogg';
import TokenStore from './token-store';

const { log } = snooplogg('amplify-auth:file-store');

/**
 * A file-based token store.
 */
export default class FileStore extends TokenStore {
	/**
	 * Initializes the file store.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.tokenStoreDir] - The directory to save the token file when the
	 * `default` token store is used.
	 * @access public
	 */
	constructor(opts = {}) {
		super(opts);

		if (!opts.tokenStoreDir || typeof opts.tokenStoreDir !== 'string') {
			throw E.MISSING_REQUIRED_PARAMETER('File token store requires a token store directory');
		}

		this.tokenStoreDir = path.resolve(opts.tokenStoreDir);
	}

	/**
	 * Deletes a token from the store.
	 *
	 * @param {String} key - The token key to delete.
	 * @returns {Promise<Boolean>}
	 * @access public
	 */
	async delete(key) {
		return deleteFile(this.getTokenFilePath(key));
	}

	/**
	 * Retreives a token from the store.
	 *
	 * @param {String} key - The token key to get.
	 * @returns {Promise<Object>} Resolves the token or `undefined` if not set.
	 * @access public
	 */
	async get(key) {
		const file = this.getTokenFilePath(key);
		if (fs.existsSync(file)) {
			try {
				return this.decode(fs.readFileSync(file, 'utf8'));
			} catch (e) {
				log(`Failed to decode ${file}: ${e.message}`);
				deleteFile(file);
			}
		}
	}

	/**
	 * Generates the path to the token file.
	 *
	 * @param {String} key - The token key.
	 * @returns {String}
	 * @access private
	 */
	getTokenFilePath(key) {
		const file = crypto.createHash('sha1').update(key).digest('hex');
		return path.join(this.tokenStoreDir, file);
	}

	/**
	 * Retreives all tokens from the store.
	 *
	 * @returns {Promise<Array>} Resolves an array of tokens.
	 * @access public
	 */
	async list() {
		const dir = this.tokenStoreDir;
		if (!fs.existsSync(dir)) {
			return [];
		}

		const tokens = await Promise.all(fs.readdirSync(dir).map(name => new Promise(resolve => {
			const file = path.join(dir, name);
			fs.readFile(file, 'utf8', (err, str) => {
				if (!err) {
					try {
						return resolve(this.decode(str));
					} catch (e) {
						log(`Failed to decode ${file}: ${e.message}`);
						deleteFile(file);
					}
				}
				resolve();
			});
		})));

		return tokens.filter(t => t);
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
		const file = this.getTokenFilePath(key);
		await fs.mkdirp(this.tokenStoreDir);
		log(`Writing tokens to ${file}`);
		fs.writeFileSync(file, this.encode(data), { mode: 384 /* 600 */ });
	}
}

/**
 * Removes a file, if it exists.
 *
 * @param {String} file - The path of the file to delete.
 * @returns {Boolean} Returns `true` if the file was removed or `false` if the file does not exist
 * or failed to be removed.
 */
function deleteFile(file) {
	try {
		log(`Deleting token file ${file}`);
		fs.removeSync(file);
		return true;
	} catch (e) {
		return false;
	}
}
