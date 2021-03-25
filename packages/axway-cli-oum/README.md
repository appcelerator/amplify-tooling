# Axway AMPLIFY OUM CLI

Manage organizations, teams, and members.

## Installation

This package is bundled with the Axway CLI and thus does not need to be directly installed.

	npm i -g axway

## Usage

### Organizations

List all organizations:

	$ axway org list

View an organization:

	$ axway org view

	$ axway org view <org>

Rename an organization:

	$ axway org rename <org> <name>

### Organization Members

List all organization members:

	$ axway org member list <org>

Add a member to an org:

	$ axway org member add <org> <guid|email> --role <role1> [...--role <role2>]

Update a member's roles:

	$ axway org member update <org> <guid|email> --role <role1> [...--role <role2>]

Delete a member:

	$ axway org member remove <org> <guid|email>

### Organization Teams

List all organization teams:

	$ axway team list [org]

View a team's info:

	$ axway team view <org> <team>

Add a team to an org:

	$ axway team add <org> <name> --desc [value] --tag [tag1] --tag [tag2] --default

Update a team:

	$ axway team update # shows help

	$ axway team update <org> <team> # shows help

	$ axway team update <org> <team> --name [value] --desc [value] --tag [tag1] --tag [tag2] --default

Remove a team from an org:

	$ axway team remove <org> <team>

### Organization Team Members

List all members in a team:

	$ axway team member list <org> <team>

Add a member to a team:

	$ axway team member add <org> <team> <guid|email> --role <role1> [...--role <role2>]

Update a member's role within a team:

	$ axway team member update <org> <team> <guid|email> --role <role1> [...--role <role2>]

Remove a member from a team:

	$ axway team member remove <org> <team> <guid|email>

### Organization Usage

View the usage:

	$ axway org usage <org> --from [yyyy-mm-dd] --to [yyyy-mm-dd]

### Organization Activity

View the organization activity:

	$ axway org activity <org> --from [yyyy-mm-dd] --to [yyyy-mm-dd]

### Organization IdP

TBD

### Account Management

View an account including organizations and roles:

	$ axway user view

Update your account information:

	$ axway user update --first-name <name> --last-name <name>

View your user activity:

	$ axway user activity --from [yyyy-mm-dd] --to [yyyy-mm-dd]

Change your log in credentials:

	$ axway user credentials

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-auth/LICENSE
