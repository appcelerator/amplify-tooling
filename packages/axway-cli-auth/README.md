# Axway Auth CLI

Authenticates a machine with the Axway Amplify platform.

## Installation

This package is bundled with the Axway CLI and thus does not need to be directly installed.

	npm i -g axway

## Quick Start

Log into the Axway platform:

	axway auth login

Log out of the Axway platform:

	axway auth logout

## Authentication Commands

### `list`

Lists all credentialed accounts.

Alias: `ls`

```
axway auth list

axway auth list --json
```

### `login`

Log in to the Axway Amplify platform.

```
axway auth login

axway auth login --json

axway auth login --client-secret <CLIENT_SECRET>

axway auth login --client-secret <CLIENT_SECRET> --username my@email.com

axway auth login --secret-file <path/to/pem/file>

axway auth login --secret-file <path/to/pem/file> --username my@email.com
```

### `logout`

Log out all or specific accounts from the Amplify platform.

Alias: `revoke`

```
axway auth logout --all

axway auth logout --all --json

axway auth logout <ACCOUNT_NAME_1> <ACCOUNT_NAME_2>
```

## Service Account Commands

### `list`

List all service accounts for an organization:

```
axway service-account list

axway service-account list --org <org-guid/name/id>
```

### `create`

Create a service account with interactive prompting:

```
axway service-account create
```

Create a service account with minimum non-interactive arguments:

```
axway service-account create --name foo --secret bar
```

### `update`

Change a service account name, description, and role:

```
axway service-account update <name/client-id> --name <new_name> --desc <desc> --role <role>
```

### `add-team` and `remove-team`

Add a team to an existing service account:

```
axway service-account add-team <client-id/name> <team_guid> <team_role>
```

Remove a team from a service account:

```
axway service-account remove-team <client-id/name> <team_guid>
```

### `remove`

Remove a service account:

```
axway service-account remove <client-id/name>
```

### `roles`

View available team roles:

```
axway service-account roles
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-auth/LICENSE
