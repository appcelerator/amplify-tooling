# Axway AMPLIFY OUM CLI

Manage organizations, teams, and users.

## Installation

This package is bundled with the Axway CLI and thus does not need to be directly installed.

	npm i -g axway

## Usage

### Organizations

List all organizations:

```
$ axway org list
```

View an organization:

```
$ axway org view <org>
```

Edit an organization:

```
$ axway org set <org> <key> <value>
```

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-auth/LICENSE
