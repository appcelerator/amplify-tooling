/* eslint-disable security/detect-non-literal-require */

import crypto from 'crypto';
import E from '../errors';
import FileStore from './file-store';
import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';
import snooplogg from 'snooplogg';

import { spawnSync } from 'child_process';

const { log } = snooplogg('amplify-auth:secure-store');
const { highlight } = snooplogg.styles;

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
	 * @param {Object} opts - Various options.
	 * @param {String} opts.homeDir - The path to the home directory containing the `lib`
	 * directory where `keytar` is located.
	 * @param {String} [opts.secureServiceName="Axway AMPLIFY Auth"] - The name of the consumer
     * using this library.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected opts to be an object');
		}

		const { homeDir } = opts;
		if (!homeDir || typeof homeDir !== 'string') {
			throw E.INVALID_PARAMETER('Secure store requires the home directory to be specified');
		}

		const supportedVersion = fs.readJsonSync(path.resolve(__dirname, '..', '..', 'package.json')).keytar;
		const prefix = path.join(homeDir, 'lib', 'keytar', `${process.platform}_${process.arch}_${process.versions.modules}`);
		const keytarPath = path.join(prefix, 'node_modules', 'keytar');
		const pkgJsonFile = path.join(keytarPath, 'package.json');
		let keytar;

		try {
			const installedVersion = fs.readJsonSync(pkgJsonFile).version;
			if (!semver.satisfies(installedVersion, supportedVersion)) {
				log(`Installed keytar out-of-date: ${highlight(installedVersion)}, required ${highlight(supportedVersion)}`);
				throw new Error();
			}

			log(`Loading keytar: ${highlight(keytarPath)}`);
			keytar = require(keytarPath);
		} catch (e) {
			const args = [ 'install', `keytar@${supportedVersion}`, '--no-save', '--production', '--prefix', prefix ];
			if (e.message) {
				log(`keytar not found, running: ${highlight(`npm ${args.join(' ')}`)}`);
			}
			fs.removeSync(keytarPath);

			const env = Object.assign({ NO_UPDATE_NOTIFIER: 1 }, process.env);
			const result = spawnSync('npm', args, { env, shell: true });
			log(`npm install exited (code ${result.status})`);

			if (result.error) {
				log(result.error);
				if (result.error.code === 'ENOENT') {
					throw E.NPM_ERROR('npm executable not found');
				} else {
					throw E.NPM_ERROR(result.error.message);
				}
			}

			if (result.status) {
				throw E.NPM_ERROR(`npm failed with exit code ${result.status}`);
			}

			try {
				keytar = require(keytarPath);
			} catch (e2) {
				log(e2);
				throw E.NPM_ERROR(`Failed to install keytar. Please check that your version of Node.js (${process.version}) is supported.`);
			}
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
			await this.keytar.deletePassword(this.serviceName, this.serviceName);
			throw e;
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
