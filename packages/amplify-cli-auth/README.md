# AMPLIFY CLI Authentication

Authenticates a machine with the Axway AMPLIFY platform.

## Installation

This package is bundled with the AMPLIFY CLI and thus does not need to be directly installed.

	npm i -g @axway/amplify-cli

## Quick Start

Log into the Axway platform:

	amplify auth login

Log out of the Axway platform:

	amplify auth logout

## Commands

### `list`

Lists all credentialed accounts.

Alias: `ls`

```
amplify auth list

amplify auth list --json
```

### `login`

Log in to the Axway AMPLIFY platform.

```
amplify auth login

amplify auth login --json

amplify auth login <username> <password>

amplify auth login --secret <CLIENT_SECRET>

amplify auth login --secret-file <path/to/pem/file>
```

### `logout`

Log out all or specific accounts from the AMPLIFY platform.

Alias: `revoke`

```
amplify auth logout --all

amplify auth logout --all --json

amplify auth logout <ACCOUNT_NAME_1> <ACCOUNT_NAME_2>
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-auth/LICENSE
