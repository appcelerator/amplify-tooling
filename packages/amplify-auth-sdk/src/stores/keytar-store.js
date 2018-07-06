import E from '../errors';
import TokenStore from './token-store';

/**
 * ?
 */
export default class KeytarStore extends TokenStore {
	/**
	 * ?
	 *
	 * @access public
	 */
	constructor() {
		super();

		try {
			const keytar = require('keytar');
		} catch (e) {
			throw E.KEYTAR_NOT_FOUND('"keytar" package not found, is it installed?');
		}
	}
}
