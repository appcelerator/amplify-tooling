/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Auth from '@axway/amplify-auth-sdk';

export class APS {
	constructor(authOpts) {
		this.authOpts = authOpts;

		this.aca = {
			getUploadURL: () => ''
		};

		this.acs = {
			createApp: () => '',
			createUser: () => '',
			getUsers: () => ''
		};

		this.auth = {
			find: name => this.client.getAccount(name),
			list: () => this.client.list(),
			login: () => '',
			logout: params => this.client.revoke(params),
			serverInfo: () => this.client.serverInfo()
		};

		this.org = {
			getEnvironments: () => ''
		};

		this.ti = {
			getApp: () => '',
			buildVerify: () => '',
			buildUpdate: () => '',
			getDownloads: () => '',
			enroll: () => '',
			register: () => '',
			setApp: () => '',
			unregister: () => ''
		};
	}

	get client() {
		try {
			if (!this._client) {
				this._client = new Auth(this.authOpts);
			}
			return this._client;
		} catch (err) {
			if (err.code === 'ERR_SECURE_STORE_UNAVAILABLE') {
				const isWin = process.platform === 'win32';
				err.message = `Secure token store is not available.\nPlease reinstall the AMPLIFY CLI by running:\n    ${isWin ? '' : 'sudo '}npm install --global ${isWin ? '' : '--unsafe-perm '}@axway/amplify-cli`;
			}
			throw err;
		}
	}
}

export default APS;
