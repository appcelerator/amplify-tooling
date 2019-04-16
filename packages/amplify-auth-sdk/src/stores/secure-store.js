/* eslint-disable security/detect-non-literal-require */

import crypto from 'crypto';
import E from '../errors';
import FileStore from './file-store';
import fs from 'fs-extra';
import path from 'path';
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

		const keytarVersion = fs.readJsonSync(path.resolve(__dirname, '..', '..', 'package.json')).keytar.replace(/[^\d.]*/g, '');
		const prefix = path.join(homeDir, 'lib', 'keytar', `${keytarVersion}_${process.platform}_${process.arch}_${process.versions.modules}`);
		const keytarPath = path.join(prefix, 'node_modules', 'keytar');
		let keytar;

		try {
			// the first step is to try to load the exact version
			log(`Loading keytar: ${highlight(keytarPath)}`);
			keytar = require(keytarPath);
		} catch (e) {
			// just in case there was a pre-existing botched install
			fs.removeSync(keytarPath);

			// failed because version not installed or Node version change
			const args = [ 'install', `keytar@${keytarVersion}`, '--no-save', '--production', '--prefix', prefix ];
			log(`keytar not found, running: ${highlight(`npm ${args.join(' ')}`)}`);

			// run npm install
			const env = Object.assign({ NO_UPDATE_NOTIFIER: 1 }, process.env);
			const result = spawnSync('npm', args, { env, windowsHide: true });
			log(`npm install exited (code ${result.status})`);

			if (result.error) {
				// spawn error
				throw E.NPM_ERROR(`npm Error: ${result.error.code === 'ENOENT' ? 'npm executable not found' : result.error.message} (code ${result.status})`);
			}

			if (result.status) {
				const output = result.stderr.toString().trim();
				output && log(output);
				throw E.NPM_ERROR(`npm Error: ${output ? String(output.split(/\r\n|\n/)[0]).replace(/^\s*error:\s*/i, '') : 'unknown error'} (code ${result.status})`);
			}

			const output = result.stdout.toString().trim();
			output && log(output);

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
