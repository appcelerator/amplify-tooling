/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Auth from '@axway/amplify-auth-sdk';

export class APS {
	constructor(authOpts) {
		this.auth = null;
		this.authOpts = authOpts;

		this.accounts = {
			list: () => this.client.list()
		};
	}

	get client() {
		if (!this._client) {
			try {
				this._client = new Auth(this.authOpts);
			} catch (err) {
				if (err.code === 'ERR_SECURE_STORE_UNAVAILABLE') {
					const isWin = process.platform === 'win32';
					err.message = `Secure token store is not available.\nPlease reinstall the AMPLIFY CLI by running:\n    ${isWin ? '' : 'sudo '}npm install --global ${isWin ? '' : '--unsafe-perm '}@axway/amplify-cli`;
				}
				throw err;
			}
		}
		return this._client;
	}
}

export default APS;
