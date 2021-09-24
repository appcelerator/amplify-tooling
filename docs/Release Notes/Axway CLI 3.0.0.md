# Axway CLI 3.0.0

## Sep 24, 2021

This is a major release with breaking changes, new features, bug fixes, and dependency updates.

### Installation

```
npm i -g axway@3.0.0
```

### axway

 * **v3.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
   * feat: Added `telemetry` to help improve Axway products.
     ([APIGOV-19209](https://jira.axway.com/browse/APIGOV-19209))
   * feat: Add non-production environment title to banner.
   * fix: Only error out when config file is bad when running a config command.
   * refactor: Move `--env` from auth and oum CLI's to the Axway CLI.
   * style: Fixed indentation of error messages.
   * doc: Fixed Axway CLI documentation URL in post install message.

### amplify-cli-utils

 * **v5.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Added `initPlatformAccount()` from `@axway/axway-cli-oum`.
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
   * feat: Added `telemetry` to help improve Axway products.
     ([APIGOV-19209](https://jira.axway.com/browse/APIGOV-19209))
   * feat: Added environment titles.
   * feat: Added helper function to resolve the environment specific auth config key.
   * feat: Added environment argument to platform account initialization.
   * chore: Updated dependencies.

### amplify-config

 * **v4.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))

### amplify-request

 * **v3.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))

### amplify-sdk

 * **v3.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
   * feat: Added `telemetry` to help improve Axway products.
     ([APIGOV-19209](https://jira.axway.com/browse/APIGOV-19209))
   * feat: Added options to filter available roles by `client`, `default`, and `org`.
   * feat: Added support to activity and usage methods for selecting a date range by month.
     ([APIGOV-19922](https://jira.axway.com/browse/APIGOV-19922))
   * fix: Removed redundant platform account and team assertions.
   * fix(auth): Use authenticated account's baseUrl and realm when logging out.
   * fix(auth): Add ability to find an authenticated account by name or hash.
   * fix(auth): Resolve environment name when creating an auth client.
   * chore: Updated dependencies.

### amplify-utils

 * **v1.0.0** - 9/24/2021

   * Initial release.

### axway-cli-auth

 * **v3.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Renamed package from `@axway/amplify-cli-auth` to `@axway/axway-cli-auth`.
   * refactor: Removed `bin` from package.
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
   * feat: Added `service-account` command with ability to create, update, and remove service
     accounts.
   * fix: Removed incorrectly defined `--client-id` from all auth commands except `login`.
   * fix: Correctly filter accounts by the current environment.
     ([APIGOV-19744](https://jira.axway.com/browse/APIGOV-19744))
   * fix(logout): Suppress opening web browser message when `--json` is set.
   * chore: Updated dependencies.

### axway-cli-oum

 * **v2.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Renamed `axway team add` command to `axway team create` and added `add` as an alias.
   * refactor: Removed `bin` from package.
   * refactor: Moved `initPlatformAccount()` to `@axway/amplify-cli-utils`.
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
   * feat: Added support to activity and usage methods for selecting a date range by month.
     ([APIGOV-19922](https://jira.axway.com/browse/APIGOV-19922))
   * fix(org:view): Always show teams section even if there are no teams.
   * fix: Properly validate account name and error when a service account is specified.
     ([APIGOV-19678](https://jira.axway.com/browse/APIGOV-19678))
   * chore: Updated dependencies.

### axway-cli-pm

 * **v4.0.0** - 9/24/2021

   * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
     ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
   * refactor: Removed `bin` from package.
   * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
     ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
   * fix(view): Fixed filtering package properties when outputting as JSON.
   * fix(view): Improve error handling when package name is invalid.
   * doc: Added additional information to `axway pm` help output.
   * chore: Updated dependencies.

### gulp-tasks

 * **v4.0.3** - 9/14/2021

   * fix: Fixed typo.

 * **v4.0.2** - 9/14/2021

   * chore: Removed unused `babel-loader` dependency.

 * **v4.0.1** - 9/14/2021

   * chore: Updated dependencies.
   * chore: Remove unused `package` template.

 * **v4.0.0** - 9/14/2021

   * BREAKING CHANGE: Requires Node.js 12.13.0 or newer.
   * BREAKING CHANGE: Removed Babel configurations for Node 10 and older.
   * refactor: Copied `appcd-gulp` package from `appc-daemon` repo.