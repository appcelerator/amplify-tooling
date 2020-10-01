# AMPLIFY Request

HTTP/HTTPS request library that wraps [got](https://www.npmjs.com/package/got) and wires up proxy support.

## Installation

	npm install @axway/amplify-request

## Usage

Create a `got` instance:

```js
import * as request from '@axway/amplify-request';

const got = request.init({
	ca: '/path/to/ca-bundle.pem',
	proxy: 'https://localhost:3129',
	strictSSL: false
	// ... other got options
});

const { body } = await got('https://www.axway.com', { retry: 0 });
```

Create `got` options object:

```js
import * as request from '@axway/amplify-request';

const opts = request.options({
	ca: '/path/to/ca-bundle.pem',
	defaults: {
		// `defaults` is a helper for declaring values loaded from a config file
		caFile: '/path/to/ca-bundle.pem',
		certFile: '/path/to/cert.crt',
		keyFile: '/path/to/private.key',
		proxy: 'https://localhost:3129',
		strictSSL: true
	},
	proxy: 'https://localhost:3129',
	strictSSL: false
	// ... other got options
});
```

Get a regular `got` instance:

> Note that `got` does not support the `ca`, `cert`, `defaults`, `key`, `proxy`, or `strictSSL`
> properties. Those are specific to `request.options()` and `request.init()`.

```js
import * as request from '@axway/amplify-request';

let response = await request.got('https://www.axway.com/', { retry: 0 });

// or pass in a generated options object

const opts = request.options({
	proxy: 'https://localhost:3129'
});
response = await request.got('https://www.axway.com/', opts);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-utils/LICENSE
