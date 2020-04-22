# AMPLIFY SDK

The AMPLIFY SDK for Node.js is a set of APIs for authenticating, retrieving organization
information, and switching the user's current organization.

## Installation

	npm i @axway/amplify-sdk --save

## Overview

The AMPLIFY SDK relies on the [AMPLIFY Auth SDK][2] for authenticating and managing access tokens.
For organization related information, it talks directly to the Axway platform.

```js
account: {
	auth {
		//
	},
	user: {
		email:        '',
		firstName:    '',
		guid:         '',
		lastName:     '',
		axwayId:      '',
		is2FAEnabled: true,
		organization: ''
	},
	org: {
		guid: '',
		id: '',
		name: ''
	},
	orgs: [
		{ /* org */ },
		{ /* org */ }
	]
}
```

## API

```js
import AmplifySDK from '@axway/amplify-sdk';

const sdk = new AmplifySDK({ ...config });

// auth

await sdk.aca.getUploadURL();

await sdk.acs.createApp();
await sdk.acs.createUser();
await sdk.acs.getUsers();

let account = await sdk.auth.find();
account = await sdk.auth.login();
console.log(account.org);
console.log(account.user);
const accounts = await sdk.auth.list();
await sdk.auth.switchOrg();
await sdk.auth.logout();
await sdk.auth.findSession();
await sdk.auth.serverInfo();

await sdk.org.getEnvironments();

await sdk.ti.getApp();
sdk.ti.getAppVerifyURL();
await sdk.ti.buildVerify();
await sdk.ti.buildUpdate();
await sdk.ti.getDownloads();
await sdk.ti.enroll();
await sdk.ti.register();
await sdk.ti.setApp()
await sdk.ti.unregister();
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-sdk/LICENSE
[2]: https://github.com/appcelerator/amplify-tooling/tree/master/packages/amplify-auth-sdk
