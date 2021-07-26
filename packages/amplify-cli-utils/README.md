# Axway CLI Utils

A common utils library for Axway CLI and related packages.

## Installation

	npm i @axway/amplify-cli-utils --save

## API

### `buildAuthParams(opts, config)`

Creates an Amplify SDK or Amplify SDK Auth constructor options object based on the supplied `opts`
and Axway CLI `config` object. If `config` is not defined, the config is loaded from disk.

```js
import { buildAuthParams } from '@axway/amplify-cli-utils';

const opts = buildAuthParams({
	baseUrl: 'foo',
	clientId: 'bar'
});
```

### `createNPMRequestArgs(opts, config)`

If you are spawning `npm`, then the following may be useful:

```js
import { createNPMRequestArgs } from '@axway/amplify-cli-utils';
import { spawnSync } from 'child_process';

spawnSync('npm', [ 'view', 'axway', ...createNPMRequestArgs() ]);
```

### `createRequestClient(opts, config)`

Creates a `got` HTTP client with the Axway CLI network settings configured.

```js
import { createRequestClient } from '@axway/amplify-cli-utils';

const got = createRequestClient();
const response = await got('https://www.axway.com/');
```

### `createRequestOptions(opts, config)`

Loads the Axway CLI config file and construct the options for the various Node.js HTTP clients
including `pacote`, `npm-registry-fetch`, `make-fetch-happen`, and `request`.

```js
import { createRequestOptions } from '@axway/amplify-cli-utils';

const opts = createRequestOptions();
console.log({
	ca:        opts.ca,
	cert:      opts.cert,
	key:       opts.key,
	proxy:     opts.proxy,
	strictSSL: opts.strictSSL
});
```

### `createTable(heading1, heading2, heading3, ...)`

Creates a `cli-table3` instance with common table padding and styling.

```js
import { createTable } from '@axway/amplify-cli-utils';

const table = createTable('Name', 'Version');
table.push([ 'foo', '1.0.0' ]);
table.push([ 'bar', '2.0.0' ]);
console.log(table.toString());
```

### `environments.resolve(env)`

Returns environment specific settings.

```js
import { environments } from '@axway/amplify-cli-utils';

console.log(environments.resolve());
console.log(environments.resolve('prod'));
console.log(environments.resolve('production'));
```

### `locations`

An object containing the `axwayHome` and `configFile` paths.

```js
import { locations } from '@axway/amplify-cli-utils';

console.log('Axway Home Directory:', locations.axwayHome);
console.log('Axway CLI Config Path:', locations.configFile);
```

### `initSDK(opts, config)`

Loads the Axway CLI config and initializes an Amplify SDK instance.

#### Get the default account or login if needed:

```js
import { initSDK } from '@axway/amplify-cli-utils';

async function getAccount(opts) {
	try {
		return await initSDK(opts).sdk.auth.login();
	} catch (err) {
		if (err.code === 'EAUTHENTICATED') {
			return err.account;
		}
		throw err;
	}
}

(async () => {
	const account = await getAccount({ clientId: 'foo' });
	if (!account) {
		console.error('Please login in by running: amplify auth login');
		process.exit(1);
	}
}());
```

#### Find account by login parameters

```js
import { initSDK } from '@axway/amplify-cli-utils';

(async () => {
	const { sdk, config } = initSDK({
		baseUrl:      '',
		clientId:     '',
		clientSecret: '',
		env:          '',
		password:     '',
		realm:        '',
		secretFile:   '',
		username:     ''
	});

	const account = await sdk.auth.find('foo');

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
const accountName = '<client_id>:<email_address>';
const account = await sdk.auth.getAccount(accountName);
```

### Get all credentialed accounts

```js
const accounts = await sdk.auth.list();
console.log(accounts);
```

### `loadConfig()`

Loads the Axway CLI config file using the lazy loaded Amplify Config package.

```js
import { loadConfig } from '@axway/amplify-cli-utils';

const config = loadConfig();
console.log(config);
```

## Telemetry

If you'd like to add telemetry to an Axway CLI extension, then you will need to create an app in
the platform to generate an app guid. Then you'll need to copy and paste the following boilerplate.
The API is designed to be flexible at the cost of being more work to integrate.

```js
import {
	createRequestOptions,
	environments,
	loadConfig,
	locations,
	Telemetry
} from '@axway/amplify-cli-utils';

const appGuid = '<GUID>';
const appVersion = 'x.y.z';
const telemetryCacheDir = path.join(locations.axwayHome, '<PRODUCT_NAME>', 'telemetry');

function initTelemetry(opts = {}) {
	const config = opts.config || loadConfig();
	if (!config.get('telemetry.enabled')) {
		return;
	}

	const env = environments.resolve(opts.env || config.get('env'));

	const telemetryInst = new Telemetry({
		appGuid,
		appVersion,
		cacheDir,
		environment: env === 'preprod' ? 'preproduction' : 'production',
		requestOptions: createRequestOptions(opts, config)
	});

	process.on('exit', () => {
		try {
			telemetryInst.send();
		} catch (err) {
			warn(err);
		}
	});

	return telemetryInst;
}

const telemetry = initTelemetry();
telemetry.addEvent({
	event: 'my.event',
	some: 'data'
});
```

## Upgrading from version 1.x

In v2, the entire `auth` API was removed to take advantage of the new Amplify SDK, which now
contains the auth API.

```js
// Find account by login parameters

// v1
import { auth } from '@axway/amplify-cli-utils';
const { account, client, config } = await auth.getAccount({ /* auth options */ });

// v2
import { initSDK } from '@axway/amplify-cli-utils';
const { config, sdk } = initSDK({ /* auth options */ });
const account = await sdk.auth.find();
```

```js
// Find account by id

// v1
import { auth } from '@axway/amplify-cli-utils';
const { account, client, config } = await auth.getAccount('<CLIENT_ID>:<EMAIL>');

// v2
import { initSDK } from '@axway/amplify-cli-utils';
const { config, sdk } = initSDK({ /* auth options */ });
const account = await sdk.auth.find('<CLIENT_ID>:<EMAIL>');
```

```js
// Get all credentialed accounts

// v1
import { auth } from '@axway/amplify-cli-utils';
const accounts = await auth.list();

// v2
import { initSDK } from '@axway/amplify-cli-utils';
const { config, sdk } = initSDK({ /* auth options */ });
const accounts = await sdk.auth.list();
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-utils/LICENSE
