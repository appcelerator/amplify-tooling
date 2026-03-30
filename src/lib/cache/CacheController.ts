import dayjs from 'dayjs';
import { lstatSync, readFileSync } from 'fs';
import fse from 'fs-extra';
import pkg from 'lodash';
import NodeCache from 'node-cache';
import { homedir } from 'os';
import path from 'path';
import { CACHE_FILE_TTL_MILLISECONDS, MAX_CACHE_FILE_SIZE } from '../types.js';
import { isValidJson, writeToFile } from '../utils/utils.js';
import logger from '../logger.js';

const { log } = logger('axway-cli: CacheController');
const { isEmpty } = pkg;

interface Cache {
	set(key: string, value: object): CacheControllerClass;
	get(key: string): any;
	readFromFile(): CacheControllerClass;
	writeToFile(): CacheControllerClass;
}

interface StoredCache {
	data?: object;
	metadata?: {
		modifyTimestamp?: number;
		schemaVersion?: string;
	};
}

/**
 * Note: this file intentionally exporting only a single instance of CacheController,
 * since its possible to face a race condition when multiple instances will try to read/write file at the same time
 * Please do not use this class directly or rework the logic before.
 */
class CacheControllerClass implements Cache {
	public cacheFilePath = path.join(
		homedir(),
		'.axway',
		'central',
		'cache.json',
	);
	private cache = new NodeCache();

	constructor() {
		// note: init cache fire only once since using only a single instance of the class, remove if this will change
		this.initCacheFile();
		this.readFromFile();
	}

	/**
   * Inits and validate cache file, should run once before using this class in the code (initialized in cli.ts currently)
   * An empty JSON file will be created if it is not exists of the file size is more than some value.
   */
	initCacheFile() {
		try {
			if (fse.pathExistsSync(this.cacheFilePath)) {
				log(`init, cache file found at ${this.cacheFilePath}`);
				const stats = lstatSync(this.cacheFilePath);
				log(`init, cache file size: ${Math.round(stats.size / 1000)} kb`);
				if (stats.size >= MAX_CACHE_FILE_SIZE) {
					// validating the size
					log(
						`init, cache size is exceeding the max allowed size of ${Math.round(
							MAX_CACHE_FILE_SIZE / 1000,
						)} kb, resetting the file`,
					);
					fse.outputJsonSync(this.cacheFilePath, {});
				} else if (!isValidJson(readFileSync(this.cacheFilePath, 'utf8'))) {
					// validating the content
					log('init, cache content is invalid, resetting the file ');
					fse.outputJsonSync(this.cacheFilePath, {});
				}
			} else {
				log(
					`init, cache file not found, creating an empty one at ${this.cacheFilePath}`,
				);
				fse.outputJsonSync(this.cacheFilePath, {});
			}
		} catch (e) {
			log('cannot initialize cache file', e);
		}
	}

	/**
   * Set the key in memory cache.
   * @param key cache key to set
   * @param value value to set, note that setting "undefined" value will result in "null" value stored
   * @returns CacheController instance
   */
	set(key: string, value: any): CacheControllerClass {
		this.cache.set(key, value);
		return this;
	}

	/**
   * Returns the key value from the memory cache.
   * @param key key to get
   * @returns key value
   */
	get(key: string): any | undefined {
		return this.cache.get(key);
	}

	/**
   * Load stored cache from the file into memory and checks its timestamp.
   * If the timestamp is more than X days old it will reset the file without any changes to cache.
   * Note: using this method before writeToFile() will override keys in memory cache with the same name.
   * @returns CacheController instance
   */
	readFromFile() {
		try {
			log('reading cache from the file');
			const jsonData = readFileSync(this.cacheFilePath, 'utf8');
			const storedCache = JSON.parse(jsonData);

			// validate values stored in the cache, reset the content of the file if its not empty already.
			if (
				storedCache.data
        && storedCache.metadata
        && storedCache.metadata.modifyTimestamp
        && dayjs().diff(storedCache.metadata.modifyTimestamp, 'milliseconds')
          < CACHE_FILE_TTL_MILLISECONDS
			) {
				for (const [ key, val ] of Object.entries(storedCache.data)) {
					if (Object.prototype.hasOwnProperty.call(storedCache.data, key)) {
						this.cache.set(key, val);
					}
				}
			} else if (!isEmpty(storedCache)) {
				log(
					'timestamp or content is not valid and file is not empty, resetting the cache file',
				);
				fse.outputJsonSync(this.cacheFilePath, {});
			}
		} catch (e) {
			log('cannot read cache from the file', e);
		}
		return this;
	}

	/**
   * Writes current set of keys to the json file with following structure:
   * {
   * 	metadata: {
   *     modifyTimestamp: current timestamp, used on read for TTL validation
   *     schemaVersion: indicates the version of cache file structure, can be used later on if changing it.
   *   },
   *   data: {} key-value cache data
   * }
   * @returns CacheController instance
   */
	writeToFile() {
		try {
			log('writing cache to the file');
			const keys = this.cache.keys();
			const cachedData = this.cache.mget(keys);
			const dataToStore: StoredCache = {
				metadata: {
					modifyTimestamp: Date.now(),
					schemaVersion: '1',
				},
				data: cachedData,
			};
			writeToFile(this.cacheFilePath, JSON.stringify(dataToStore));
		} catch (e) {
			log('cannot write cache to the file', e);
		}
		return this;
	}
}

export const CacheController = new CacheControllerClass();
