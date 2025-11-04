import _ from 'lodash';
import path from 'path';
import logger, { highlight } from './logger.js';
import { readJsonSync, writeJsonSync } from './fs.js';
import { axwayHome, expandPath } from './path.js';

export const configFile = path.join(axwayHome, 'axway-cli', 'config.json');

const { log, error } = logger('config');

// Singleton config instance
let singletonConfig: Config;
export function getConfigInstance(): Config {
	return singletonConfig;
}

/**
 * Load a users config, if no configFile is given then the default Axway CLI config will be
 * loaded.
 *
 * @param {Object} [opts] - An object with various options.
 * @param {Object} [opts.config] - A object to initialize the config with. Note that if a
 * `configFile` is also specified, this `config` is applied AFTER the config file has been loaded.
 * @param {String} [opts.configFile] - The path to a .json config file to load.
 * @returns {Promise<Config>}
 */
export async function loadConfig(opts: any = {}) {
	// validate the config options
	if (opts.config && (typeof opts.config !== 'object' || Array.isArray(opts.config))) {
		throw new TypeError('Expected config to be an object');
	}

	if (opts.configFile && typeof opts.configFile !== 'string') {
		throw new TypeError('Expected config file to be a string');
	}

	// If a different config file is specified, load it fresh each time
	if (opts.configFile && opts.configFile !== configFile) {
		return await new Config().init({
			data: opts.config,
			file: expandPath(opts.configFile)
		});
	}

	// Otherwise return the singleton config
	if (!singletonConfig) {
		singletonConfig = await new Config().init({
			data: opts.config,
			file: expandPath(opts.configFile || configFile)
		});
	}

	return singletonConfig;
}

export default loadConfig;

/**
 * Manages configuration data loaded from and saved to a JSON file.
 *
 * @example
 * ```typescript
 * const config = new Config().init({ file: '/path/to/config.json' });
 * config.set('foo', 'bar');
 * config.save();
 * ```
 */
export class Config {
	#data: any;
	#file: string;

	constructor() {
		this.#data = {};
	}

	/**
	 * Initializes the configuration object with the provided options.
	 *
	 * @param {Object} opts An options object containing initialization options.
	 * @param {String} [opts.file] The path to a `.json` file as a string. Required.
	 * @param {Object} [opts.config] An optional object to merge into the configuration data.
	 * @returns {Config} The current instance for chaining.
	 */
	init(opts: { file?: string; data?: object } = {}): this {
		this.#file = opts.file;
		if (!this.#file || typeof this.#file !== 'string' || !this.#file.endsWith('.json')) {
			throw new TypeError('Expected file to be a string path to a .json file');
		}

		try {
			this.load();
		} catch (e) {
			error(e.message);
		}

		if (opts.data && typeof opts.data === 'object' && !Array.isArray(opts.data)) {
			this.#data = { ...this.#data, ..._.cloneDeep(opts.data) };
		}

		return this;
	}

	/**
	 * Loads the configuration data from the JSON file.
	 *
	 * @returns {Object} The loaded configuration data.
	 */
	load() {
		log(`Loading config file: ${highlight(this.#file)}`);

		try {
			const content = readJsonSync(this.#file);
			this.#data = _.merge(this.#data, content);
		} catch (e) {
			e.message = `Failed to load config file: ${e.message}`;
			throw e;
		}

		return this.#data;
	}

	/**
	 * Retrieves a deep clone of the entire configuration data.
	 *
	 * @returns {Object} A deep clone of the configuration data.
	 */
	data() {
		return _.cloneDeep(this.#data);
	}

	/**
	 * Retrieves a value from the configuration data.
	 *
	 * @param {String} [key] The key of the configuration value to retrieve.
	 * @param {any} [defaultValue] The default value to return if the key is not found.
	 * @returns {any} The configuration value or the default value.
	 */
	get(key?: string, defaultValue?: any) {
		if (!key) {
			return this.#data;
		}

		return _.get(this.#data, key, defaultValue);
	}

	/**
	 * Sets a value in the configuration data.
	 *
	 * @param {String} key The key of the configuration value to set.
	 * @param {any} value The value to set.
	 */
	set(key: string, value: any) {
		_.set(this.#data, key, value);
	}

	/**
	 * Checks if a key exists in the configuration data.
	 *
	 * @param {String} key The key of the configuration value to check.
	 * @returns {Boolean} True if the key exists, false otherwise.
	 */
	has(key: string) {
		return _.has(this.#data, key);
	}

	/**
	 * Deletes a key from the configuration data.
	 *
	 * @param {String} key The key of the configuration value to delete.
	 */
	delete(key: string) {
		log(`Deleting key "${highlight(key)}" from config data`);
		_.unset(this.#data, key);
	}

	/**
	 * Adds a value to the end of an array in the configuration data.
	 * If the array does not exist, it will be created.
	 *
	 * @param {String} key The key of the array to modify.
	 * @param {any} value The value to add to the array.
	 */
	push(key: string, value: any) {
		const arr = this.get(key) || [];
		arr.push(value);
		this.set(key, arr);
	}

	/**
	 * Removes and returns the last value from an array in the configuration data.
	 *
	 * @param {String} key The key of the array to modify.
	 * @returns {any} The removed value.
	 */
	pop(key: string) {
		const arr = this.get(key);
		if (!Array.isArray(arr)) {
			throw new TypeError(`Expected config key "${key}" to be an array`);
		}
		const value = arr.pop();
		this.set(key, arr);
		return value;
	}

	/**
	 * Shifts the first value from an array in the configuration data.
	 *
	 * @param {String} key The key of the array to modify.
	 * @returns {any} The removed value.
	 */
	shift(key: string) {
		const arr = this.get(key);
		if (!Array.isArray(arr)) {
			throw new TypeError(`Expected config key "${key}" to be an array`);
		}
		const value = arr.shift();
		this.set(key, arr);
		return value;
	}

	/**
	 * Adds a value to the beginning of an array in the configuration data.
	 * If the array does not exist, it will be created.
	 *
	 * @param {String} key The key of the array to modify.
	 * @param {any} value The value to add to the array.
	 */
	unshift(key: string, value: any) {
		const arr = this.get(key) || [];
		arr.unshift(value);
		this.set(key, arr);
	}

	/**
	 * Retrieves all keys from the configuration data.
	 *
	 * @returns {String[]} An array of all configuration keys.
	 */
	keys() {
		return Object.getOwnPropertyNames(this.#data);
	}

	/**
	 * Saves the configuration data to the JSON file.
	 *
	 * @returns {Object} The saved configuration data.
	 */
	save() {
		writeJsonSync(this.#file, this.#data);
		log(`Wrote config file: ${highlight(this.#file)}`);
		return this.#data;
	}

	/**
	 * Converts the configuration data to a JSON string.
	 *
	 * @param {Number} [indentation=2] The number of spaces to use for indentation.
	 * @returns {String} The configuration data as a JSON string.
	 */
	toString(indentation = 2) {
		return JSON.stringify(this.#data, null, indentation);
	}

	/**
	 * Converts the configuration data to a plain object.
	 *
	 * @returns {Object} The configuration data as a plain object.
	 */
	toJSON() {
		return _.cloneDeep(this.#data);
	}
}
