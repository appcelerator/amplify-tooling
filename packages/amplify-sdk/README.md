# AMPLIFY SDK

The AMPLIFY SDK for Node.js is a set of APIs for authenticating, switching selected organization,
creating MBS apps and users, and Titanium SDK support.

## Installation

	npm i @axway/amplify-sdk --save

## Usage

```js
import AmplifySDK from '@axway/amplify-sdk';

// opts can include `env` as well as any AMPLIFY Auth SDK constructor opts
// (see https://www.npmjs.com/package/@axway/amplify-auth-sdk)
const sdk = new AmplifySDK({ ...opts });
```

### Auth

```js
// get all authenticated accounts
const accounts = await sdk.auth.list();

// find an authenticated account by name and refresh access token if needed
let account = await.sdk.auth.find('foo');

// login using pkce browser-based flow
account = await sdk.auth.login();
console.log(account.org);
console.log(account.user);

// switch active org, assuming you belong to more than one
await sdk.auth.switchOrg(account, orgId);
console.log(`Active org is now ${account.org.name}`);

// log out of specific or all accounts
await sdk.auth.logout({ accounts: [ account ] });
// or: await sdk.auth.logout({ all: true });

// show auth server info
const info = await sdk.auth.serverInfo();
console.log(info);
```

### MBS (formerly ACS)

```js
// create an MBS app in each platform environment
const apps = await sdk.mbs.createApps(account, '<GUID>', '<NAME>');

// create a new MBS user for a given group id (app guid) and environment (production/development)
const user = await sdk.mbs.createUser(account, '<GROUP ID>', '<ENVIRONMENT>', {
	admin:         undefined,
	custom_fields: undefined,
	email:         'user@domain.com',
	first_name:    '',
	last_name:     '',
	password:      '', // required
	password_confirmation: '', // required
	photo_id:      undefined,
	role:          undefined,
	tags:          undefined,
	username:      undefined
});

// get all MBS users for a given group id (app guid) and environment (production/development)
const users = await sdk.mbs.getUsers(account, '<GROUP ID>', '<ENVIRONMENT>');
```

### Orgs

```js
// retrieve a list of all available platform environments such
// as 'production' and 'development'
const envs = await sdk.org.getEnvironments(account);
console.log(envs);
```

### Titanium

```js
// update Titanium app build info
await sdk.ti.buildUpdate(account, {
	buildId: 123,
	buildSHA: '<SHA>',
	keys: {
		'file1': 'key1',
		'file2': 'key2'
	}
});

// verify Titanium app and modules prior to a build
await sdk.ti.buildVerify(account, {
	appGuid:     '<GUID>',
	appId:       '<ID>',
	deployType:  'production',
	fingerprint: '<FINGERPRINT>',
	ipAddress:   '<IPADDRESS>',
	modules:     [],
	tiapp:       '<ti:app><name/><id/><guid/></ti:app>'
});

// create developer certificate
await sdk.ti.enroll(account, {
	description: '<CERTIFICATE DESCRIPTION>',
	fingerprint: '<FINGERPRINT>',
	publicKey: '<PUBLIC KEY>'
});

// get the URL for upload debug symbols after building an iOS app
const { url, api_token, limit } = await sdk.ti.getUploadURL(account, '<APP GUID>');

// get info about a Titanium app
const info = await sdk.ti.getApp(account, '<APP GUID>');

// the runtime app verification URL
const url = sdk.ti.getAppVerifyURL();

// get available Titanium module downloads
const downloads = await sdk.ti.getDownloads(account);

// update or register a Titanium app
await sdk.ti.setApp(account, '<ti:app><name/><id/><guid/></ti:app>');
```

## Account Object

The AMPLIFY SDK relies on the [AMPLIFY Auth SDK][2] for authenticating and managing access tokens.
For organization related information, it talks directly to the Axway platform.

```js
account: {
	auth {
		authenticator: 'PKCE',
		baseUrl: 'https://login.axway.com',
		clientId: 'amplify-cli',
		env: {
			name: 'prod',
			baseUrl: 'https://login.axway.com',
			redirectLoginSuccess: 'https://platform.axway.com/'
		},
		expires: { access: 1587685009628, refresh: 1587700615628 },
		realm: 'Broker',
		tokens: {
			access_token: '<SNIP>',
			expires_in: 1800,
			refresh_expires_in: 17406,
			refresh_token: '<SNIP>',
			token_type: 'bearer',
			id_token: '<SNIP>',
			'not-before-policy': 1571719187,
			session_state: '<SNIP>',
			scope: 'openid'
		}
	},
	hash: 'amplify-cli:abcdef1234567890',
	name: 'amplify-cli:user@domain.com',
	org: {
		guid: '<GUID>',
		id: 12345,
		name: 'Example Org'
	},
	orgs: [
		{ /* org */ },
		{ /* org */ }
	],
	user: {
		axwayId:      '<SNIP>',
		email:        '',
		firstName:    '',
		guid:         '',
		lastName:     '',
		organization: '',
		is2FAEnabled: true
	},
	sid: '<SNIP>'
}
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-sdk/LICENSE
[2]: https://github.com/appcelerator/amplify-tooling/tree/master/packages/amplify-auth-sdk
