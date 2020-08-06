/* eslint-disable security/detect-non-literal-require */

import crypto from 'crypto';
import E from '../errors';
import FileStore from './file-store';
import fs from 'fs-extra';
import path from 'path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';
import { isDir, isFile } from 'appcd-fs';
import { sync as spawnSync } from 'cross-spawn';

const { log, warn } = snooplogg('amplify-auth:secure-store');
const { highlight } = snooplogg.styles;

/**
 * A operating-specific secure token store.
 */
export default class SecureStore extends FileStore {
	/**
	 * The name of the token store file.
	 * @type {String}
	 */
	filename = '.tokenstore.secure.v2';

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

		const libDir = path.join(homeDir, 'amplify-cli', 'lib');
		const legacyLibDir = path.join(homeDir, 'lib');

		if (!isDir(libDir) && isDir(legacyLibDir)) {
			fs.moveSync(legacyLibDir, libDir);
		}

		const keytarVersion = fs.readJsonSync(path.resolve(__dirname, '..', '..', 'package.json')).keytar.replace(/[^\d.]*/g, '');
		const prefix = path.join(libDir, 'keytar', `${keytarVersion}_${process.platform}_${process.arch}_${process.versions.modules}`);
		const keytarPath = path.join(prefix, 'node_modules', 'keytar');
		let keytar;

		const cacheDir = tmp.tmpNameSync({ prefix: 'amplify-auth-sdk-npm-cache' });
		fs.mkdirpSync(cacheDir);

		try {
			// the first step is to try to load the exact version
			log(`Loading keytar: ${highlight(keytarPath)}`);
			keytar = require(keytarPath);
		} catch (e) {
			// just in case there was a pre-existing botched install
			fs.removeSync(keytarPath);

			const env = Object.assign({
				NO_UPDATE_NOTIFIER: 1,
				npm_config_cache: cacheDir
			}, process.env);

			log(`node ${highlight(process.version)} modules ${highlight(process.versions.modules)} npm ${highlight(spawnSync('npm', [ '-v' ], { env, windowsHide: true }).stdout.toString().trim())}`);

			// failed because version not installed or Node version change
			const args = [ 'install', `keytar@${keytarVersion}`, '--no-audit', '--no-save', '--production', '--prefix', prefix ];
			log(`keytar not found, running: ${highlight(`npm_config_cache=${cacheDir} npm ${args.join(' ')}`)}`);

			// run npm install
			const result = spawnSync('npm', args, { env, windowsHide: true });
			log(`npm install exited (code ${result.status})`);

			if (result.error) {
				// spawn error
				throw E.NPM_ERROR(`${result.error.code === 'ENOENT' ? 'npm executable not found' : result.error.message} (code ${result.status})`);
			}

			if (result.status) {
				const output = result.stderr.toString().trim();
				output && log(output);
				if (process.platform === 'linux' && output.includes('libsecret')) {
					throw E.NPM_ERROR([
						'AMPLIFY Auth requires "libsecret" which must be manually installed.',
						'  Debian/Ubuntu: sudo apt-get install libsecret-1-dev',
						'  Red Hat-based: sudo yum install libsecret-devel',
						'  Arch Linux:    sudo pacman -S libsecret'
					].join('\n'));
				}
				throw E.NPM_ERROR(`${output ? String(output.split(/\r\n|\n/)[0]).replace(/^\s*error:\s*/i, '') : 'unknown error'} (code ${result.status})`);
			}

			const output = result.stdout.toString().trim();
			output && log(output);

			try {
				keytar = require(keytarPath);
			} catch (e2) {
				log(e2);
				throw E.NPM_ERROR(`Failed to install keytar@${keytarVersion}. Please check that your version of Node.js (${process.version}) is supported.\n${e2.toString()}`);
			}
		} finally {
			if (fs.existsSync(cacheDir)) {
				log(`Cleaning up temp npm cache dir: ${highlight(cacheDir)}`);
				fs.removeSync(cacheDir);
			}
		}

		super(opts);

		this.keytar = keytar;
		this.serviceName = opts.secureServiceName || 'Axway AMPLIFY Auth';
		this.tokenStoreFile = path.join(this.tokenStoreDir, this.filename);

		// check if token store file needs to be migrated
		const legacyTokenStoreFile = path.join(homeDir, this.filename);
		if (!isFile(this.tokenStoreFile) && isFile(legacyTokenStoreFile)) {
			fs.moveSync(legacyTokenStoreFile, this.tokenStoreFile);
		}
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
	async getKey() {
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
						'  amplify config set auth.tokenStoreType file'
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
