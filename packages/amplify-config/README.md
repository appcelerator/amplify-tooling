# Amplify Config

Configuration helper for the Axway CLI.

## Installation

	npm i -g @axway/amplify-config

## Config Helper

```js
import loadConfig from '@axway/amplify-config';

// load just the Axway CLI config file
let config = loadConfig();
console.log(config);

// load a default config file, then merge another config file on top
config = loadConfig({ configFile: '/path/to/default/config.js' });
console.log(config);

// load a specific config file instead of the default config file
config = loadConfig({ userConfigFile: '/path/to/default/my-config.js' });
console.log(config);
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-utils/LICENSE
