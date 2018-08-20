import crypto from 'crypto';
import E from '../errors';
import FileStore from './file-store';
import path from 'path';
import snooplogg from 'snooplogg';

const { log, warn } = snooplogg('amplify-auth:secure-store');

/**
 * A operating-specific secure token store.
 */
export default class SecureStore extends FileStore {
	/**
	 * The name of the token store file.
	 * @type {String}
	 */
	filename = '.tokenstore.secure';

	/**
	 * Loads the `keytar` library and initializes the token file.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.secureServiceName="Axway AMPLIFY Auth"] - The name of the consumer
     * using this library.
	 * @access public
	 */
	constructor(opts = {}) {
		let keytar;

		try {
			keytar = require('keytar');
		} catch (e) {
			/* istanbul ignore next */
			throw E.KEYTAR_NOT_FOUND('"keytar" package not found, is it installed?');
		}

		super(opts);

		this.keytar = keytar;
		this.serviceName = opts.secureServiceName || 'Axway AMPLIFY Auth';
		this.tokenStoreFile = path.join(this.tokenStoreDir, this.filename);
	}

	/**
	 * Decodes the supplied string into an object.
	 *
	 * @param {String} str - The string to decode into an object.
	 * @returns {Array}
	 * @access private
	 */
	async decode(str) {
		try {
			return await super.decode(str);
		} catch (e) {
			warn(e);
			await this.keytar.deletePassword(this.serviceName, this.serviceName);
			return [];
		}
	}

	/**
	 * Gets the decipher key or generates a new one if it doesn't exist.
	 *
	 * @returns {String}
	 * @access private
	 */
	async getKey() {
		if (!this._key) {
			let key = await this.keytar.getPassword(this.serviceName, this.serviceName);
			if (!key) {
				log('Generating new key...');
				key = crypto.randomBytes(16).toString('hex');
				await this.keytar.setPassword(this.serviceName, this.serviceName, key);
			}
			Object.defineProperty(this, '_key', { value: Buffer.from(key, 'hex') });
		}
		return this._key;
	}
}
