# AMPLIFY Request

HTTP/HTTPS request library that wraps [got](https://www.npmjs.com/package/got) and wires up proxy support.

## Installation

	npm install @axway/amplify-request

## Usage

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

The following code is how you can get the original unaltered `got` instance.

> Note that `got` does not support the `ca`, `proxy`, or `strictSSL` properties. Those are specific
> to `request.init()`.

```js
import * as request from '@axway/amplify-request';

const { body } = request.got('https://www.axway.com/', { retry: 0 });
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-utils/LICENSE
