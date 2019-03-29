# AMPLIFY CLI Utils

A common utils library for AMPLIFY CLI and related packages.

## Installation

	npm i -g @axway/amplify-cli-utils

## Authentication Helper

A simple helper that loads the config file and attempts to find the account tokens by auth params
or by id.

### Find account by login parameters

```js
import { auth } from '@axway/amplify-cli-utils';

(async () => {
	const params = {
		baseUrl:      '',
		clientId:     '',
		clientSecret: '',
		env:          '',
		password:     '',
		realm:        '',
		secretFile:   '',
		username:     ''
	};

	const { account, client, config } = await auth.getAccount(params);

	if (account && !account.expired) {
		console.log('Found a valid access token!');
		console.log(account);
		return;
	}

	console.error('No valid authentication token found. Please login in again by running:');
	console.error('  amplify auth login');
	process.exit(1);
}());
```

### Find account by id

```js
import { auth } from '@axway/amplify-cli-utils';

(async () => {
	const id = 'ID GOES HERE';

	const { account, client, config } = await auth.getAccount(id);

	if (account && !account.expired) {
		console.log('Found a valid access token!');
		console.log(account);
		return;
	}

	console.error('No valid authentication token found. Please login in again by running:');
	console.error('  amplify auth login');
	process.exit(1);
}());
```

### Get all credentialed accounts

```js
import { auth } from '@axway/amplify-cli-utils';

(async () => {
	const accounts = await auth.list();
	console.log(accounts);
}());
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-utils/LICENSE
