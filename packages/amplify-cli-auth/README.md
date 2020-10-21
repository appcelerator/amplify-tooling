# Axway Auth CLI

Authenticates a machine with the Axway AMPLIFY platform.

## Installation

This package is bundled with the Axway CLI and thus does not need to be directly installed.

	npm i -g axway

## Quick Start

Log into the Axway platform:

	axway auth login

Log out of the Axway platform:

	axway auth logout

## Commands

### `list`

Lists all credentialed accounts.

Alias: `ls`

```
axway auth list

axway auth list --json
```

### `login`

Log in to the Axway AMPLIFY platform.

```
axway auth login

axway auth login --json

axway auth login --username

axway auth login --username <username>

axway auth login --username <username> --password <password>

axway auth login --secret <CLIENT_SECRET>

axway auth login --secret-file <path/to/pem/file>
```

### `logout`

Log out all or specific accounts from the AMPLIFY platform.

Alias: `revoke`

```
axway auth logout --all

axway auth logout --all --json

axway auth logout <ACCOUNT_NAME_1> <ACCOUNT_NAME_2>
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-auth/LICENSE
