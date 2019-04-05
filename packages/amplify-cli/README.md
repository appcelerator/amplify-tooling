# AMPLIFY CLI

The AMPLIFY CLI is the unified CLI for the Axway AMPLIFY platform.

## Installation

	npm i -g @axway/amplify-cli

## Quick Start

Show all available commands:

	amplify

Install a package:

	amplify pm install appcd

Log into the Axway platform:

	amplify auth login

## Extensions

AMPLIFY CLI is a unified CLI and provides a main entry point for invoking other local CLI programs.
These other CLIs are called "extensions". Extension CLIs can be a npm package, a single Node.js
JavaScript file, or a native executable.

With the exception of [cli-kit][2] enabled CLIs, all extension CLIs are run as subprocesses and the
AMPLIFY CLI banner is suppressed. The only indication an extension CLI has that it's being run by
the AMPLIFY CLI is the `AMPLIFY_CLI` environment variable containing the AMPLIFY CLI's version.

cli-kit enabled CLIs are directly loaded via `require()` and the exported CLI structure is merged
with the parent CLI command context tree. This promotes efficient reuse parser state and provides a
seamless user experience.

If an extension is a npm package, the AMPLIFY CLI will automatically invoke it using the Node.js
executable. Specifying the extension as `node /path/to/script.js` will treat the extension as a
native executable.

*Detached mode* is an another packaging option where your extension is directly made available as a 
standalone executable (meaning without the underlying AMPLIFY CLI). To achieve this, you could 
for example rely on [Nexe](https://github.com/nexe/nexe) to package your extension as a binary 
directly aiming your operating system.

### Creating an Extension CLI

#### Step 1

Create a new Node.js project as you normally would. Add cli-kit to your project:

```
$ yarn add cli-kit --save
```

#### Step 2

You will need to create at least 2 JavaScript files: one that defines the CLI structure (`cli.js`)
and one that executes it (`main.js`).

`cli.js` exports the definition of your CLI structure including its commands and options.

```js
import CLI from 'cli-kit';

export default new CLI({
	banner: 'My Amazing CLI, version 1.2.3',
	commands: {
		profit: {
			async action({ argv, console }) {
				console.log(`It works{argv.turbo ? ' and it\'s super fast' : ''}!`);
			},
			desc: 'make it rain'
		}
	},
	desc: '',
	help: true,
	helpExitCode: 2,
	name: 'mycli',
	options: {
		'--turbo': 'go faster'
	}
});
```

> :bulb: You may also export your CLI using the CommonJS method where `module.exports = new CLI();`.

`main.js` imports your `cli.js` and executes it as well as defines your global error handler.

```js
import cli from './cli';

cli.exec()
	.catch(err => {
		const exitCode = err.exitCode || 1;

		if (err.json) {
			console.log(JSON.stringify({
				code: exitCode,
				result: err.toString()
			}, null, 2));
		} else {
			console.error(err.message || err);
		}

		process.exit(exitCode);
	});
```

While not required, you probably will also want to add a `bin` script to your project so you can run
your CLI outside of the AMPLIFY CLI:

```js
#!/usr/bin/env node
require('../dist/main');
```

#### Step 3

Edit your `package.json` and set the following `"keywords"`, `"amplify"`, and `"cli-kit"` top-level property:

```json
{
  "keywords": [
    "amplify-package"
  ],
  "amplify": {
    "type": "amplify-cli-plugin"
  },
  "cli-kit": {
    "description": "This description is optional and overrides the top-level description",
    "main": "./path/to/cli"
  }
}
```

> :warning: the `"main"` must point to the script exporting the CLI definition (`cli.js`), not the
> main or bin script.

When an extension CLI is loaded, the contents of the `"cli-kit"` property is merged on top of the
entire `package.json` definition. This allows you to override the `name` and `description`.

#### Step 4

To register your CLI with the AMPLIFY CLI, simply run:

```
$ amplify config set extensions.mycli /path/to/package
```

> :bulb: Note that the extension path should be to your local project directory containing the
> `package.json`.

#### Step 5

Run your CLI!

```
$ amplify mycli profit --turbo
It works and it's super fast!
```

### Publishing Your CLI

Publish your CLI as you normally would using `npm publish`. To install your CLI, you could
`npm install -g <name>`, but then you would also have to manually register it with the AMPLIFY CLI.

The recommended way to install your CLI package is to use teh AMPLIFY CLI package manager:

```
$ amplify pm install <name>
```

This will not only download and install the package, including dependencies, but also automatically
register it with the AMPLIFY CLI.

> :bulb: Note that the AMPLIFY CLI package manager allows for multiple versions of a package to be
> installed simultaneously, however only one is the "active" version. Run the `amplify pm ls`
> command to see which versions are installed and run the `amplify pm use <name>@<version>` command
> to switch the active version.

### cli-kit package.json Properties

Below are the supported `"cli-kit"` properties in the `package.json`.

> :warning: Note that while each property is optional, the `"cli-kit"` property __MUST__ exist in
> order for the AMPLIFY CLI to detect the Node.js package as

| Name | Type | Description |
| --- | --- | --- |
| `name` | String | The primary name of the CLI command that will be visible in the help. This is especially useful when the package name is a scoped package. Defaults to the original package name. |
| `description` | String | A brief description to show on the help screen. Defaults to the original package description |
| `main` | String | A path relative to the `package.json` to the main JavaScript file. It is __critical__ that this file exports a `CLI` object. |
| `aliases` | Array&lt;String&gt; | An array of names that will invoke the extension CLI. These are _not_ displayed on the help screen. |

> :bulb: Note about aliases:
>
> If the npm package's `package.json` has a `bin` that matches original package name, but differs from
> the `"cli-kit"` extension name, then the `bin` name is automatically added to the list of aliases.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli/LICENSE
[2]: https://github.com/cb1kenobi/cli-kit
