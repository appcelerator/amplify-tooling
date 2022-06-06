import AmplifySDK from "../amplify-sdk";
import E from '../errors.js';
import { Account } from '../types.js';

export default class Base {
	sdk: AmplifySDK;

	constructor(sdk: AmplifySDK) {
		this.sdk = sdk;
	}

	/**
	 * Checks that the specified account is a platform account.
	 *
	 * @param {Object} account - The account object.
	 */
	assertPlatformAccount(account: Account) {
		if (!account || typeof account !== 'object') {
			throw E.INVALID_ACCOUNT('Account required');
		}

		if (!account.isPlatform) {
			throw E.INVALID_PLATFORM_ACCOUNT('Account must be a platform account');
		}
	}
}