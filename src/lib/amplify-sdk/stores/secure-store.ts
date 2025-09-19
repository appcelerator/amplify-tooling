import crypto from 'crypto';
import E from '../errors.js';
import FileStore from './file-store.js';
import path from 'path';
import snooplogg from 'snooplogg';
import keytar from 'keytar';

const { log, warn } = snooplogg('amplify-sdk:auth:secure-store');

/**
 * A operating-specific secure token store.
 */
export default class SecureStore extends FileStore {
	/**
	 * The name of the token store file.
	 * @type {String}
	 */
	override filename = '.tokenstore.secure.v2';
	keytar: typeof keytar;
	serviceName: string;

	/**
	 * Loads the `keytar` library and initializes the token file.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.homeDir - The path to the home directory containing the `lib`
	 * directory where `keytar` is located.
	 * @param {Object} [opts.requestOptions] - HTTP client options.
	 * @param {String} [opts.secureServiceName="Axway AMPLIFY Auth"] - The name of the consumer
     * using this library.
	 * @access public
	 */
	constructor(opts: any = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected opts to be an object');
		}

		const { homeDir } = opts;
		if (!homeDir || typeof homeDir !== 'string') {
			throw E.INVALID_PARAMETER('Secure store requires the home directory to be specified');
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
	override async decode(str) {
		try {
			return await super.decode(str);
		} catch (e) {
			if (e.amplifyCode === 'ERR_BAD_KEY') {
				await this.keytar.deletePassword(this.serviceName, this.serviceName);
			}
			throw e;
		}
	}

	/**
	 * Gets the decipher key or generates a new one if it doesn't exist.
	 *
	 * @returns {String}
	 * @access private
	 */
	override async getKey() {
		if (!this._key) {
			let key;

			try {
				key = await this.keytar.getPassword(this.serviceName, this.serviceName);
			} catch (err) {
				if (process.platform === 'linux') {
					// this is likely due to d-bus daemon not running (i.e. "Connection refused") or
					// running in a non-desktop (headless) environment (i.e. "Cannot autolaunch D-Bus without X11")
					warn(err.message);
					throw new Error([
						'Unable to get the secure token store key.',
						'',
						'On Linux, the secure token store requires a desktop environment.',
						'SSH sessions and headless environments are not supported.',
						'',
						'To use the insecure token store, run the following:',
						'',
						'  axway config set auth.tokenStoreType file'
					].join('\n'));
				}
				throw err;
			}

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
