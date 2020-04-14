# AMPLIFY Platform SDK

The AMPLIFY Platform SDK for Node.js is a set of APIs for authenticating, retrieving organization
information, and switching the user's current organization.

## Installation

	npm i @axway/amplify-platform-sdk --save

## Overview

The Platform SDK relies on the [AMPLIFY Auth SDK][2] for authenticating and managing access tokens. For
organization related information, it talks directly to the Axway platform.

```js
account: {
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
import APS from '@axway/amplify-platform-sdk';

const client = new APS({ config });
```

### Auth/Accounts

```js
client.auth.?
```

### Orgs

```js
client.orgs.?
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-platform-sdk/LICENSE
[2]: https://github.com/appcelerator/amplify-tooling/tree/master/packages/amplify-auth-sdk
