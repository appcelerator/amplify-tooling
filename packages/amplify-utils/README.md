# Amplify Utils

A library for solving common filesystem, path, and more.

## Installation

	npm i @axway/amplify-utils --save

## fs

```js
import {
	existsSync,
	isDir,
	isFile,
	mkdirpSync,
	moveSync,
	writeFileSync
} from '@axway/amplify-utils';

console.log(existsSync('/path/to/something'));

console.log(isDir('/path/to/some/dir'));

console.log(isFile('/path/to/some/file'));
```

## path

```js
import {
	expandPath
} from '@axway/amplify-utils';

// replace ~ with the user's home path and join any additional segments
console.log(expandPath('~/foo', 'bar'));
```

## utils

```js
import { arch } from '@axway/amplify-utils';

console.log(arch()); // 'x86' or 'x64'
```

```js
import { get } from '@axway/amplify-utils';

const obj = {
	foo: 'bar'
};

console.log(get(obj, 'foo')); // 'bar'
console.log(get(obj, 'baz', 'pow')); // 'pow'
```

```js
import { mergeDeep } from '@axway/amplify-utils';

const obj1 = {
	a: {
		b: 'c'
	}
};

const obj2 = {
	a: {
		d: 'e'
	}
};

console.log(mergeDeep(obj1, obj2)); // { a: { b: 'c', d: 'e' } }
```

```js
import { osInfo } from '@axway/amplify-utils';

console.log(osInfo());
```

```js
import { randomBytes } from '@axway/amplify-utils';

console.log(randomBytes(20));
```

```js
import { redact } from '@axway/amplify-utils';

console.log(redact({
	info: {
		username: 'chris',
		password: '123456',
		desktop: '/Users/chris/Desktop'
	}
}));
// {
//   info: {
//     username: '<REDACTED>', // matches process.env.USER
//     password: '<REDACTED>', // matches blocked property
//     desktop: '~/Desktop'    // matches process.env.HOME
//   }
// }
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-utils/LICENSE
