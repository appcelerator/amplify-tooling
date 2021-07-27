# Axway CLI

The Axway CLI is the unified CLI for the Axway Amplify platform.

## Prerequisites

The Axway CLI requires [Node.js][1] 10.19.0 or newer.

## Installation

	npm install -g axway

### macOS and Linux Users

Due to file permissions, when installing the Axway CLI globally, you may need to prefix the
command above with `sudo`:

	sudo npm install -g axway

## Quick Start

Show all available commands:

	axway

Log into the Axway Amplify platform:

	axway auth login

List available packages:

	axway pm search [keyword]

Install a package:

	axway pm install [package-name]

List config settings:

	axway config ls

Set a config setting:

	axway config set <name> <value>

## Config Settings

<table><tbody>
	<tr>
		<th>Name</th>
		<th>Type</th>
		<th>Default</th>
		<th>Description</th>
	</tr>
	<tr>
		<td><code>auth.clientId</code></td>
		<td>string</td>
		<td><code>"amplify-cli"</code></td>
		<td>The global client ID to use when authenticating. You can be logged into multiple different client IDs at the same time.</td>
	</tr>
	<tr>
		<td><code>auth.serverHost</code></td>
		<td>string</td>
		<td><code>"localhost"</code></td>
		<td>The hostname the local web server should listen on and await the successful login browser redirect.</td>
	</tr>
	<tr>
		<td><code>auth.serverPort</code></td>
		<td>number</td>
		<td><code>3000</code></td>
		<td>The port number the local web server should listen on and await the successful login browser redirect. Must be between<code>1024</code> and <code>65535</code>.</td>
	</tr>
	<tr>
		<td><code>auth.tokenRefreshThreshold</code></td>
		<td>number</td>
		<td><code>0</code></td>
		<td>The number of seconds before the access token expires and should be refreshed. As long as the refresh token is not expired, a new access token can be retrieved. This setting is only useful if the access token is still valid, but almost expired and you need a valid access token for an operation in the near future. Must be a non-negative integer.</td>
	</tr>
	<tr>
		<td><code>auth.tokenStoreType</code></td>
		<td>string</td>
		<td><code>"secure"</code></td>
		<td><p>The type of store to persist the access token after authenticating.</p>
			<p>Allowed values:</p>
			<ul>
				<li><code>"auto"</code> : Attempts to use the <code>"secure"</code> store, but falls back to <code>"file"</code> if secure store is unavailable.</li>
				<li><code>"secure"</code> : Encrypts the access token and using a generated key which is stored in the system's keychain.</li>
				<li><code>"file"</code> : Encrypts the access token using the embedded key.</li>
				<li><code>"memory"</code> : Stores the access token in memory instead of on disk. The access tokens are lost when the process exits. This is intended for testing purposes only.</li>
				<li><code>"null"</code> : Disables all forms of token persistence and simply returns the access token. Subsequent calls to login in the same process will force the authentication flow. This is intended for migration scripts and testing purposes only.</li>
			</ul>
		</td>
	</tr>
	<tr>
		<td><code>env</code></td>
		<td>string</td>
		<td><code>"prod"</code></td>
		<td>The name of the environment to use for all commands.</td>
	</tr>
	<tr>
		<td><code>extensions.&lt;name&gt;</code></td>
		<td>string</td>
		<td></td>
		<td>The path to an Axway CLI extension. The <code>"name"</code> is the command name and is displayed in the Axway CLI's list of commands. The value is a path to the extension which can be a Node.js package directory or an executable. If the path is a Node.js package, then the <code>"name"</code> is from the <code>package.json</code> is used. Any alpha-numeric name is acceptable except <code>"auth"</code>, <code>"config"</code>, and <code>"pm"</code>.</td>
	</tr>
	<tr>
		<td><code>network.caFile</code></td>
		<td>string</td>
		<td></td>
		<td>The path to a PEM formatted certificate authority bundle used to validate untrusted SSL certificates.</td>
	</tr>
	<tr>
		<td><code>network.proxy</code></td>
		<td>string</td>
		<td></td>
		<td><p>The URL of the proxy server. This proxy server URL is used for both HTTP and HTTPS requests.</p>
			<p>Note: If the proxy server uses a self signed certifcate, you must specify the <code>network.caFile</code>, set <code>network.strictSSL</code> to <code>false</code>, or set the environment variable <code>NODE_TLS_REJECT_UNAUTHORIZED=0</code>.</p></td>
	</tr>
	<tr>
		<td><code>network.strictSSL</code></td>
		<td>bool</td>
		<td><code>true</code></td>
		<td>Enforces valid TLS certificates on all outbound HTTPS requests. Set this to <code>false</code> if you are behind a proxy server with a self signed certificate.</td>
	</tr>
	<tr>
		<td><code>update.check</code></td>
		<td>bool</td>
		<td><code>true</code></td>
		<td>Enables automatic Axway CLI and package update checks.</td>
	</tr>
</tbody></table>

## Update Checks

The Axway CLI checks for package updates for the Axway CLI and all installed CLI extensions every
hour. If there are any available updates, a message is displayed once per hour. The update checks
can be disabled by running: `axway config set update.check false`.

## Telemetry

The Axway CLI has a telemetry system that collects anonymous data which is used to improve Axway
products. We use this data to determine product roadmaps, feature deprecations, and crash
reporting.

Data collected includes your operating system, CPU architecture, Node.js version, Axway CLI
version, installed CLI extensions, command invoked, and randomly generated machine and session ids.

Sensitive information including your username, email address, directories, and environment
variables are stripped from telemetry payloads.

You can disable telemetry by running: `axway telemetry --disable`.

Telemetry is always disabled when the `TELEMETRY_DISABLED` environment variable is set or when
running from a known continuous integration environment.

## Extensions

Axway CLI is a unified CLI and provides a main entry point for invoking other local CLI programs.
These other CLIs are called "extensions". Extension CLIs can be a npm package, a single Node.js
JavaScript file, or a native executable.

With the exception of [cli-kit][2] enabled CLIs, all extension CLIs are run as subprocesses and the
Axway CLI banner is suppressed. The only indication an extension CLI has that it's being run by
the Axway CLI is the `AXWAY_CLI` environment variable (also `AMPLIFY_CLI` for backwards
compatibility) containing the Axway CLI's version.

cli-kit enabled CLIs are directly loaded via `require()` and the exported CLI structure is merged
with the parent CLI command context tree. This promotes efficient reuse parser state and provides a
seamless user experience.

If an extension is a npm package, the Axway CLI will automatically invoke it using the Node.js
executable. Specifying the extension as `node /path/to/script.js` will treat the extension as a
native executable.

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
your CLI outside of the Axway CLI:

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

If your extension has multiple entrypoints, you can define them as "exports":

```json
{
  "cli-kit": {
    "description": "This description is optional and overrides the top-level description",
    "exports": {
		"foo": "./path/to/foo-cli",
		"bar": "./path/to/bar-cli"
	}
  }
}
```

When an extension CLI is loaded, the contents of the `"cli-kit"` property is merged on top of the
entire `package.json` definition. This allows you to override the `name` and `description`.

#### Step 4

To register your CLI with the Axway CLI, simply run:

```
$ axway config set extensions.mycli /path/to/package
```

> :bulb: Note that the extension path should be to your local project directory containing the
> `package.json`.

#### Step 5

Run your CLI!

```
$ axway mycli profit --turbo
It works and it's super fast!
```

### Publishing Your CLI

Publish your CLI as you normally would using `npm publish`. To install your CLI, you could
`npm install -g <name>`, but then you would also have to manually register it with the Axway CLI.

The recommended way to install your CLI package is to use teh Axway CLI package manager:

```
$ axway pm install <name>
```

This will not only download and install the package, including dependencies, but also automatically
register it with the Axway CLI.

> :bulb: Note that the Axway CLI package manager allows for multiple versions of a package to be
> installed simultaneously, however only one is the "active" version. Run the `axway pm ls`
> command to see which versions are installed and run the `axway pm use <name>@<version>` command
> to switch the active version.

### cli-kit package.json Properties

Below are the supported `"cli-kit"` properties in the `package.json`.

> :warning: Note that while each property is optional, the `"cli-kit"` property __MUST__ exist in
> order for the Axway CLI to detect the Node.js package as

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

### Renaming Your CLI

Should the name of your extension CLI product change, you simply need to update the `"name"` in the
`package.json`. It is highly recommended you add an alias for the previous name:

```
{
	"name": "mynewcli",
	"cli-kit": {
		"aliases": [ "myoldcli" ]
	}
}
```

Afterwards, publish the new product. The Registry Server will automatically register your new
extension CLI.

Note that commands such as `axway pm update` will not resolve the new product name. Users will
need to explicitly install the new extension CLI.

## Legal

This project is open source under the [Apache Public License v2][3] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][3] file included
in this distribution for more information.

[1]: https://nodejs.org/
[2]: https://github.com/cb1kenobi/cli-kit
[3]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/axway-cli/LICENSE
