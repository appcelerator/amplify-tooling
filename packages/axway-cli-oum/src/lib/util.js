import { initSDK } from '@axway/amplify-cli-utils';

/**
 * Initializes the Amplify SDK, loads an account, and finds the default org id.
 *
 * @param {String} [accountName] - The name of the platform account to use.
 * @param {String} [org] - The name, id, or guid of the default organization.
 * @returns {Promise<Object>}
 */
export async function initPlatformAccount(accountName, org) {
	const { config, sdk } = initSDK();
	const account = await sdk.auth.find(accountName || config.get('auth.defaultAccount'));

	if (!account || !account.isPlatform) {
		throw new Error('You must me logged into a platform account\n\nTo login, run: axway auth login');
	}

	if (org) {
		org = await sdk.org.find(account, org);
	} else {
		try {
			// check the config for a default org for this account
			org = await sdk.org.find(account, config.get(`auth.defaultOrg.${account.hash}`));
		} catch (err) {
			// default org was stale, auto detect the default from the account orgs
			org = await sdk.org.find(account);
		}
	}

	return {
		account,
		config,
		org,
		sdk
	};
}
