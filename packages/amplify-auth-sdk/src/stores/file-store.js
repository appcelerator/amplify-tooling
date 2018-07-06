import E from '../errors';
import TokenStore from './token-store';

/**
 * ?
 */
export default class FileStore extends TokenStore {
	/**
	 * ?
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.tokenStoreDir] - The directory to save the token file when the
	 * `default` token store is used.
	 * @access public
	 */
	constructor(opts = {}) {
		super();

		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (!opts.tokenStoreDir || typeof opts.tokenStoreDir !== 'string') {
			throw E.MISSING_REQUIRED_PARAMETER('Default file store requires a token store directory');
		}

		this.tokenStoreDir = opts.tokenStoreDir;
	}
}
