# Amplify SDK

The Amplify SDK for Node.js is a set of APIs for authenticating, switching selected organization,
creating MBS apps and users, and Titanium SDK support.

## Installation

	npm i @axway/amplify-sdk --save

## Usage

```js
import AmplifySDK from '@axway/amplify-sdk';

// opts can include `env` as well as any Amplify Auth SDK constructor opts
// (see https://www.npmjs.com/package/@axway/amplify-auth-sdk)
const sdk = new AmplifySDK({ ...opts });
```

### Auth

```js
// get all authenticated accounts
const accounts = await sdk.auth.list();

// find an authenticated account by name and refresh access token if needed
let account = await.sdk.auth.find('<client_id>:<email>');

// login using pkce browser-based flow
account = await sdk.auth.login();
console.log(account.org);
console.log(account.user);

// switch active org, assuming you belong to more than one
await sdk.auth.switchOrg(account, orgGuid);
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
// get all orgs
const orgs = await sdk.org.list(account);
console.log(orgs);

// find a single org
const org = await sdk.org.find(account, 'org name/id/guid');

// get org activity
const { from, to, events } = await sdk.org.activity(account, 'org name/id/guid', {
	from: '2021-01-01',
	to: '2021-01-31'
});

// retrieve a list of all available platform environments such
// as 'production' and 'development'
const envs = await sdk.org.getEnvironments(account);

// get org family including child orgs
const family = await sdk.org.family(account, 'org name/id/guid');

// rename an org
await sdk.org.rename(account, 'org name/id/guid', 'new org name');

// get org usage
const usage = await sdk.org.usage(account, 'org name/id/guid', {
	from: '2021-01-01',
	to: '2021-01-31'
});

// list all members of an org
const { users } = await sdk.org.member.list(account, 'org name/id/guid');

// get info for an org member
const user = await sdk.org.member.find(account, 'org name/id/guid', 'user guid or email');

// add a user to an org
// see https://platform.axway.com/api-docs.html#operation/org_userCreate
const roles = [ 'administrator' ]; // 'developer', 'read_only', etc...
await sdk.org.member.add(account, 'org name/id/guid', 'user guid or email', roles);

// change a member's role in an org
await sdk.org.member.update(account, 'org name/id/guid', 'user guid or email', roles);

// remove a member from an org
await sdk.org.member.remove(account, 'org name/id/guid', 'user guid or email');
```

### Roles

```js
// get org and team roles
const orgRoles = await sdk.role.list(account);

const teamRoles = await sdk.role.list(account, { team: true });
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

### Team

```js
// get all teams for an org
const { teams } = await sdk.team.list(account, 'org name/id/guid');

// get team info
const { team } = await sdk.team.find(account, 'org name/id/guid', 'team name or guid');

// create a new team
await sdk.team.create(account, 'org name/id/guid', 'team name', {
	// optional
	desc: 'Tiger team',
	default: false,
	tags: [ 'foo', 'bar' ]
});

// update team info
const { changes, team } = await sdk.team.update(account, 'org name/id/guid', 'team name or guid', {
	// optional
	desc: 'Tiger team',
	default: false,
	tags: [ 'foo', 'bar' ]
});

// remove a team
await sdk.team.remove(account, 'org name/id/guid', 'team name or guid');

// list all members of a team
const { users } = await sdk.team.member.list(account, 'org name/id/guid', 'team name or guid');

// get info for an org member
const user = await sdk.team.member.find(account, 'org name/id/guid', 'team name or guid', 'user guid or email');

// add a user to an org
// see https://platform.axway.com/api-docs.html#operation/team_userAdd
const roles = [ 'administrator' ]; // 'developer', 'read_only', etc...
await sdk.team.member.add(account, 'org name/id/guid', 'team name or guid', 'user guid or email', roles);

// change a member's role in a team
await sdk.team.member.update(account, 'org name/id/guid', 'team name or guid', 'user guid or email', roles);

// remove a member from an org
await sdk.team.member.remove(account, 'org name/id/guid', 'team name or guid', 'user guid or email');
```

### User

```js
// find a user
const user = await sdk.user.find(account, 'org name/id/guid', 'user guid or email');

// get user activity
const activity = await sdk.user.activity(account, {
	from: '2021-01-01',
	to: '2021-01-31'
});

// update user info
const { changes, user } = await sdk.user.update(account, {
	firstname: 'Elite',
	lastname: 'Coder',
	phone: '555-1212'
});
```

## Account Object

The Amplify SDK relies on the [Amplify Auth SDK][2] for authenticating and managing access tokens.
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
