# Axway CLI 2.1.0

## May 11, 2021

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g axway@2.1.0
```

### axway

 * **v2.1.0** - 5/11/2021

   * feat: Added post install welcome message.
   * fix: Properly output errors when `--json` flag is set.
   * chore: Added deprecation warning for Node.js 10 and older.
     ([CLI-110](https://jira.axway.com/browse/CLI-110))
   * chore: Updated dependencies.

### amplify-cli-auth

 * **v2.6.4** - 5/11/2021

   * fix: Added environment name to `axway auth list`.
   * style(login): Removed extra blank line when authenticating with username and password.
   * chore: Updated dependencies.

 * **v2.6.3** - 4/29/2021

   * doc: Improved help verbiage.

 * **v2.6.2** - 4/28/2021

   * chore: Updated dependencies.

 * **v2.6.1** - 4/27/2021

   * chore: Updated dependencies.

 * **v2.6.0** - 4/21/2021

   * feat: Publicly expose the `whoami` command.
   * feat(login): Added feedback when launching the web browser for an interactive login.
     ([CLI-79](https://jira.axway.com/browse/CLI-79))
   * feat: Improved handling of headless environments.
     ([CLI-116](https://jira.axway.com/browse/CLI-116))
   * fix: Properly output errors when `--json` flag is set.
   * chore: Updated dependencies.

 * **v2.5.4** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.5.3** - 1/20/2021

   * chore: Updated dependencies.

 * **v2.5.2** - 1/14/2021

   * fix(list): Fixed display of account type.
   * fix(switch): Allow service accounts to be selected as the default, but skip the org selection.

 * **v2.5.1** - 1/13/2021

   * fix(login): Display gracefully message when logging in with `--no-launch-browser` and you are
     already logged in.

 * **v2.5.0** - 1/11/2021

   * feat(list): Added platform flag to account list.
   * fix(login): Don't show the banner during login when `--json` is set.
   * fix(login): Support service accounts when logging in with `--no-launch-browser`.
   * fix(login): Fixed verbiage when logging in using a service account.
   * fix(login): Removed reference to AMPLIFY CLI.
   * fix(switch): Only allow users to switch org for authenticated platform accounts.
   * chore: Updated dependencies.

 * **v2.4.0** - 1/5/2021

   * refactor(switch): Reworked the `switch` command to use the web browser to switch the org instead
     of prompting.
   * style: Prefixed more error messages with an X symbol.

 * **v2.3.1** - 12/3/2020

   * style: Prefix error message with an X symbol.

 * **v2.3.0** - 12/1/2020

   * feat: Added `axway:auth:*` actions for `login`, `logout`, and `switch` commands.
     ([CLI-105](https://jira.axway.com/browse/CLI-105))
   * fix: Added missing AMPLIFY SDK init parameters to `logout` and `whoami` commands.
   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.

 * **v2.2.5** - 11/13/2020

   * fix(login): Fixed logged in message after logging in using a service account which has no
     platform organization.
   * fix(login): Load session after manually logging in.

 * **v2.2.4** - 11/12/2020

   * chore: Updated dependencies.

 * **v2.2.3** - 11/12/2020

   * chore: Updated dependencies.

 * **v2.2.2** - 11/10/2020

   * chore: Updated dependencies.

 * **v2.2.1** - 10/21/2020

   * chore: Updated AMPLIFY CLI references to Axway CLI.
     ([CLI-100](https://jira.axway.com/browse/CLI-100))
   * chore: Updated dependencies.

 * **v2.2.0** - 10/1/2020

   * fix(login): Added missing `--service` login flag when using `--client-secret`.
   * fix(login): Added missing `--base-url`, `--client-id`, and `--realm` login arguments.
   * fix(switch): Fixed initial selected account and org when prompting.
   * fix: Removed `preferGlobal` package setting.
   * style: Cleaned up verbiage in descriptions.
   * chore: Updated dependencies.

 * **v2.1.2** - 8/27/2020

   * fix(login): Fixed bug where login would default to the username flow instead of the pkce flow.

 * **v2.1.1** - 8/27/2020

   * chore: Updated dependencies.

 * **v2.1.0** - 8/6/2020

   * style: Adopted Axway style guide for tables.
   * chore: Updated dependencies.

 * **v2.0.3** - 8/3/2020

   * fix: Fixed bug in `switch` command which was using the org name instead of the org id.

 * **v2.0.2** - 7/24/2020

   * chore: Updated dependencies.

 * **v2.0.1** - 7/2/2020

   * fix: Set the logout command's "revoke" alias to hidden.
   * chore: Updated dependencies.

 * **v2.0.0** - 6/12/2020

   * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
     ([CLI-89](https://jira.axway.com/browse/CLI-89))
   * BREAKING CHANGE: Removed `success` flag from all CLIs with `--json` output. Callers should rely
     on exit code.
   * BREAKING CHANGE: Renamed `message` to `error` in JSON error output.
   * refactor: Updated all org references to use the org guid instead of the org id.
   * refactor: Moved `force` login check to AMPLIFY SDK.
   * refactor: Replaced `inquirer` with `enquirer`.
   * refactor: Replaced old utils `auth` with `initSDK()`.
   * refactor: `logout` no longer requires `--all` when account name(s) not specified.
   * refactor: Removed markdown-like table output in favor of cli-table3.
   * feat: Added support to `switch` command to support org guid.
   * fix: Updated options to use correct format for non-required options.
   * chore: Updated dependencies.

### amplify-cli-pm

 * **v2.5.4** - 5/11/2021

   * chore: Updated dependencies.

 * **v2.5.3** - 4/29/2021

   * chore: Updated dependencies.

 * **v2.5.2** - 4/28/2021

   * chore: Updated dependencies.

 * **v2.5.1** - 4/27/2021

   * chore: Updated dependencies.

 * **v2.5.0** - 4/21/2021

   * feat(install): Show the command to use the newly installed CLI extension.
     ([CLI-68](https://jira.axway.com/browse/CLI-68))
   * fix: Properly output errors when `--json` flag is set.
   * fix(update): Show package name and version during install steps.
     ([CLI-109](https://jira.axway.com/browse/CLI-109))
   * chore: Updated dependencies.

 * **v2.4.5** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.4.4** - 1/20/2021

   * chore: Updated dependencies.

 * **v2.4.3** - 1/14/2021

   * chore: Updated dependencies.

 * **v2.4.2** - 1/11/2021

   * chore: Updated dependencies.

 * **v2.4.1** - 1/6/2021

   * fix(uninstall): Switched to `cross-spawn` to find and run `npm` on Windows.

 * **v2.4.0** - 1/5/2021

   * feat(purge,uninstall): Added support for running a package's npm uninstall script.
   * chore: Updated dependencies.

 * **v2.3.1** - 12/3/2020

   * fix(uninstall): Remove empty package container directories.
   * fix(uninstall): Fixed issue uninstalling package with a label in the package version.
   * fix(use): Fixed issue with selecting a package with a label in the package version.
   * style: Prefix error message with an X symbol.

 * **v2.3.0** - 12/1/2020

   * feat: Added `axway:pm:*` actions for `install`, `purge`, `uninstall`, `update`, and `use`
     commands. ([CLI-105](https://jira.axway.com/browse/CLI-105))
   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * fix(use): Return all package info when `--json` flag is set.

 * **v2.2.7** - 11/18/2020

   * chore: Updated dependencies.

 * **v2.2.6** - 11/13/2020

   * chore: Updated dependencies.

 * **v2.2.5** - 11/12/2020

   * chore: Updated dependencies.

 * **v2.2.4** - 11/12/2020

   * chore: Updated dependencies.

 * **v2.2.3** - 11/12/2020

   * chore: Updated dependencies.

 * **v2.2.2** - 11/10/2020

   * chore: Updated dependencies.

 * **v2.2.1** - 10/21/2020

   * chore: Updated AMPLIFY CLI references to Axway CLI.
     ([CLI-100](https://jira.axway.com/browse/CLI-100))
   * chore: Updated dependencies.

 * **v2.2.0** - 10/1/2020

   * fix: Added back proxy server support.
   * fix: Removed `preferGlobal` package setting.
   * style: Cleaned up verbiage in descriptions.
   * chore: Updated dependencies.

 * **v2.1.1** - 8/27/2020

   * chore: Updated dependencies.

 * **v2.1.0** - 8/6/2020

   * style: Adopted Axway style guide for tables.
   * chore: Updated dependencies.

 * **v2.0.2** - 7/24/2020

   * chore: Updated dependencies.

 * **v2.0.1** - 7/2/2020

   * fix: Set several command aliases to hidden.
   * chore: Updated dependencies.

 * **v2.0.0** - 6/12/2020

   * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
     ([CLI-89](https://jira.axway.com/browse/CLI-89))
   * BREAKING CHANGE: Removed `success` flag from all CLIs with `--json` output. Callers should rely
     on exit code.
   * BREAKING CHANGE: Renamed `message` to `error` in JSON error output.
   * refactor: Removed markdown-like table output in favor of cli-table3.
   * feat: Added "unmanaged" label to installed package list.
   * fix: Only managed packages can be purged or uninstalled.
   * fix: Updated options to use correct format for non-required options.
   * style(list): Changed color of active package version.
   * chore: Updated dependencies.

### amplify-cli-utils

 * **v4.3.4** - 5/11/2021

   * fix: Prevent table padding from being styled despite there being no border.
   * chore: Updated dependencies.

 * **v4.3.3** - 4/29/2021

   * chore: Updated dependencies.

 * **v4.3.2** - 4/28/2021

   * chore: Updated dependencies.

 * **v4.3.1** - 4/27/2021

   * chore: Updated dependencies.

 * **v4.3.0** - 4/21/2021

   * feat: Added `isHeadless()` helper function.
   * feat: Autodetect if headless and force token store type to `file`.
     ([CLI-116](https://jira.axway.com/browse/CLI-116))
   * chore: Updated dependencies.

 * **v4.2.5** - 1/22/2021

   * chore: Updated dependencies.

 * **v4.2.4** - 1/20/2021

   * chore: Updated dependencies.

 * **v4.2.3** - 1/14/2021

   * chore: Updated dependencies.

 * **v4.2.2** - 1/11/2021

   * chore: Updated dependencies.

 * **v4.2.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v4.2.0** - 12/1/2020

   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * chore: Updated dependencies.

 * **v4.1.4** - 11/18/2020

   * chore: Updated dependencies.

 * **v4.1.3** - 11/13/2020

   * chore: Updated dependencies.

 * **v4.1.2** - 11/12/2020

   * chore: Updated dependencies.

 * **v4.1.1** - 11/12/2020

   * chore: Updated dependencies.

 * **v4.1.0** - 11/10/2020

   * feat: Added API for checking if update is available.
     ([CLI-22](https://jira.axway.com/browse/CLI-22))
   * chore: Updated dependencies.

 * **v4.0.0** - 10/21/2020

   * BREAKING CHANGE: Updated AMPLIFY CLI references to Axway CLI. The config file was moved from
     `~/.axway/amplify-cli/amplify-cli.json` to `~/.axway/axway-cli/config.json`.
     ([CLI-100](https://jira.axway.com/browse/CLI-100))
   * chore: Updated dependencies.

 * **v3.2.0** - 10/1/2020

   * feat: Added HTTP request helpers for preparing proxy config and creating a `got` instance.
     ([CLI-98](https://jira.axway.com/browse/CLI-98))
   * fix: Removed `preferGlobal` package setting.
   * refactor: Renamed `buildParams()` to `buildAuthParams()` to be more clear on purpose.
   * chore: Updated dependencies.

 * **v3.1.1** - 8/27/2020

   * style: Update table style.
   * chore: Updated dependencies.

 * **v3.1.0** - 8/6/2020

   * refactor: Moved AMPLIFY CLI config file from `~/.axway` to `~/.axway/amplify-cli`.

 * **v3.0.6** - 7/24/2020

   * chore: Updated dependencies.

 * **v3.0.5** - 7/2/2020

   * chore: Updated dependencies.

 * **v3.0.4** - 6/12/2020

   * chore: Updated dependencies.

 * **v3.0.3** - 6/9/2020

   * chore: Updated dependencies.

 * **v3.0.2** - 5/19/2020

   * chore: Updated dependencies.

 * **v3.0.1** - 5/5/2020

   * fix: Added missing AMPLIFY SDK dependency.

 * **v3.0.0** - 5/5/2020

   * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
     ([CLI-89](https://jira.axway.com/browse/CLI-89))
   * BREAKING CHANGE: Removed `auth` APIs. Use `initSDK()` and the resulting `sdk.auth.*` methods.
   * BREAKING CHANGE: Added `@appcd/amplify-sdk` for authentication and platform integration.
     ([DAEMON-324](https://jira.appcelerator.org/browse/DAEMON-324))
   * BREAKING CHANGE: AMPLIFY Auth SDK v2 (via AMPLIFY SDK) changed structure of `account` info by
     moving auth-related info into an `auth` property.
   * feat: Added `initSDK()` helper that loads the AMPLIFY CLI config and initializes an AMPLIFY SDK
     instance.
   * feat: Added support for environment synonyms such as "production" for "prod".
     ([CLI-87](https://jira.axway.com/browse/CLI-87))
   * chore: Removed unused `appcd-config` dependency.
   * chore: Updated dependencies.

### amplify-config

 * **v3.0.10** - 5/11/2021

   * chore: Updated dependencies.

 * **v3.0.9** - 4/27/2021

   * chore: Updated dependencies.

 * **v3.0.8** - 4/21/2021

   * chore: Updated dependencies.

 * **v3.0.7** - 1/20/2021

   * chore: Updated dependencies.

 * **v3.0.6** - 1/5/2021

   * chore: Updated dependencies.

 * **v3.0.5** - 12/1/2020

   * chore: Updated dependencies.

 * **v3.0.4** - 11/18/2020

   * chore: Updated dependencies.

 * **v3.0.3** - 11/12/2020

   * fix: Fixed bug writing migrated config file.

 * **v3.0.2** - 11/10/2020

   * fix: Removed migration of extensions due to issues if command is cancelled while copying.
   * chore: Updated dependencies.

 * **v3.0.1** - 10/26/2020

   * fix: Copy extension packages during first time migration from AMPLIFY CLI structure.
     ([CLI-103](https://jira.axway.com/browse/CLI-103))

 * **v3.0.0** - 10/21/2020

   * BREAKING CHANGE: Updated AMPLIFY CLI references to Axway CLI. The config file was moved from
     `~/.axway/amplify-cli/amplify-cli.json` to `~/.axway/axway-cli/config.json`.
     ([CLI-100](https://jira.axway.com/browse/CLI-100))

 * **v2.1.3** - 10/1/2020

   * fix: Removed `preferGlobal` package setting.

 * **v2.1.2** - 8/27/2020

   * No changes. Lerna forced version bump.

 * **v2.1.1** - 8/6/2020

   * fix: Update extension paths in config file when migrating to new AMPLIFY CLI home directory.

 * **v2.1.0** - 8/6/2020

   * refactor: Moved AMPLIFY CLI config file from `~/.axway` to `~/.axway/amplify-cli`.
   * chore: Updated dependencies.

 * **v2.0.3** - 7/24/2020

   * chore: Updated dependencies.

 * **v2.0.2** - 7/2/2020

   * chore: Updated dependencies.

 * **v2.0.1** - 6/12/2020

   * chore: Updated dependencies.

 * **v2.0.0** - 5/5/2020

   * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
     ([CLI-89](https://jira.axway.com/browse/CLI-89))
   * refactor: Replaced `appcd-config` with `config-kit`.
   * chore: Updated dependencies.

### amplify-registry-sdk

 * **v2.3.10** - 5/11/2021

   * chore: Updated dependencies.

 * **v2.3.9** - 4/29/2021

   * chore: Updated dependencies.

 * **v2.3.8** - 4/28/2021

   * chore: Updated dependencies.

 * **v2.3.7** - 4/27/2021

   * chore: Updated dependencies.

 * **v2.3.6** - 4/21/2021

   * style: Verbiage change.
   * chore: Updated dependencies.

 * **v2.3.5** - 1/22/2021

   * chore: Updated dependencies.

 * **v2.3.4** - 1/20/2021

   * chore: Updated dependencies.

 * **v2.3.3** - 1/14/2021

   * chore: Updated dependencies.

 * **v2.3.2** - 1/11/2021

   * fix: Remove "prepare" script from package's `package.json` before installing npm dependencies to
     prevent npm 7 from erroring due to only production dependencies being installed.
   * chore: Updated dependencies.

 * **v2.3.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v2.3.0** - 12/1/2020

   * feat: Added `path` to installed package info.
   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * fix: Removed dependency on appcd-subprocess.

 * **v2.2.6** - 11/18/2020

   * chore: Updated dependencies.

 * **v2.2.5** - 11/13/2020

   * fix: Check correct status code to determine if package is found.

 * **v2.2.4** - 11/12/2020

   * chore: Updated dependencies.

 * **v2.2.3** - 11/12/2020

   * fix: Added npm install error output to thrown error.

 * **v2.2.2** - 11/12/2020

   * chore: Updated dependencies.

 * **v2.2.1** - 11/10/2020

   * fix: Removed package migration from AMPLIFY CLI to Axway CLI. Packages must be reinstalled.
   * chore: Updated dependencies.

 * **v2.2.0** - 10/21/2020

   * chore: Updated AMPLIFY CLI references to Axway CLI. Note that the internal registry SDK's
     internal `cache` and `packages` directories have moved from `~/.axway/amplify-cli` to
     `~/.axway/axway-cli`. ([CLI-100](https://jira.axway.com/browse/CLI-100))
   * chore: Updated dependencies.

 * **v2.1.2** - 10/1/2020

   * fix: Removed `preferGlobal` package setting.
   * fix: Added back proxy server support. ([CLI-98](https://jira.axway.com/browse/CLI-98))
   * refactor: Switched from using `got` directly to `amplify-request`.

 * **v2.1.1** - 8/27/2020

   * chore: Updated dependencies.

 * **v2.1.0** - 8/6/2020

   * refactor: Moved cache and packages directories from `~/.axway` to `~/.axway/amplify-cli`.

 * **v2.0.2** - 7/24/2020

   * chore: Updated dependencies.

 * **v2.0.1** - 7/2/2020

   * chore: Updated dependencies.

 * **v2.0.0** - 6/12/2020

   * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
     ([CLI-89](https://jira.axway.com/browse/CLI-89))
   * feat: Added `managed` flag to package info to identify packages installed via AMPLIFY Package
     Manager and manually registered packages.
   * chore: Updated dependencies.

### amplify-request

 * **v2.1.4** - 5/11/2021

   * chore: Updated dependencies.

 * **v2.1.3** - 4/27/2021

   * chore: Updated dependencies.

 * **v2.1.2** - 4/21/2021

   * chore: Updated dependencies.

 * **v2.1.1** - 1/5/2021

   * chore: Updated dependencies.

 * **v2.1.0** - 12/1/2020

   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * chore: Updated dependencies.

 * **v2.0.1** - 10/21/2020

   * chore: Updated dependencies.

 * **v2.0.0** - 10/1/2020

   * BREAKING CHANGE: Completely new API.
   * BREAKING CHANGE: Switched from `request` to `got` http request library.
   * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
     ([CLI-89](https://jira.axway.com/browse/CLI-89))
   * feat: Added proxy support. ([CLI-98](https://jira.axway.com/browse/CLI-98))
   * chore: Updated dependencies.

### amplify-sdk

 * **v2.1.5** - 5/11/2021

   * fix: Set correct user agent for platform calls.

 * **v2.1.4** - 5/10/2021

   * fix(auth): Pass the `AmplifySDK` `got` instance into the `Auth` class so that it can pass it
     along to the `Authentication` class. ([CLI-124](https://jira.axway.com/browse/CLI-124))
   * fix: Added missing `interactiveLoginTimeout` param to login.

 * **v2.1.3** - 4/29/2021

   * chore: Republishing 2.1.2 because it was published out-of-band and lerna is confused.

 * **v2.1.2** - 4/28/2021

   * fix: Ensure user roles is always an array in the event the current user is not a member of an
     organization being found.
   * fix: Remove 401 unauthorized check and assume any error should trigger a retry using the access
     token.

 * **v2.1.1** - 4/28/2021

   * fix: Use `parseInt()` instead of an operator to cast an org id to an integer.
     ([CLI-121](https://jira.axway.com/browse/CLI-121))

 * **v2.1.0** - 4/27/2021

   * fix(token-store): Updated `keytar` from v7.6.0 to v7.7.0, which now uses N-API. The Amplify SDK
     no longer needs to install `keytar` at runtime which solves npm 7 related issues.
   * fix(login): Validate token auth code before redirecting the browser to select the organization.
   * chore: Updated dependencies.

 * **v2.0.0** - 4/21/2021

   * BREAKING CHANGE: Removed MBS and Titanium app development APIs.
     ([CLI-110](https://jira.axway.com/browse/CLI-110))
   * feat: Added organization and user management APIs.
     ([CLI-108](https://jira.axway.com/browse/CLI-108))
   * feat: Added HTTP status code to error messages.
   * fix(auth): Gracefully handle fetch user info request failures.
     ([CLI-118](https://jira.axway.com/browse/CLI-118))
   * fix(auth): Handle authentication that does not return a refresh token.
     ([CLI-119](https://jira.axway.com/browse/CLI-119))
   * feat(auth): Added `onOpenBrowser` callback param to login, switch, and logout methods.
     ([CLI-116](https://jira.axway.com/browse/CLI-116))
   * chore: Updated `keytar` from v7.4.0 to v7.6.0.
   * chore: Updated dependencies.

 * **v1.8.3** - 1/22/2021

   * fix: Added missing `realm` environment defaults.

 * **v1.8.2** - 1/20/2021

   * fix: Removed `orgSelectUrl` and appended the org select path to `platformUrl`.
   * fix(logout): Launch web browser to logout of session for platform accounts.
   * chore: Updated dependencies.

 * **v1.8.1** - 1/14/2021

   * fix: Sort the list of authenticated accounts by name.

 * **v1.8.0** - 1/11/2021

   * feat: Added `isPlatform` flag to authenticated accounts.
   * fix(server): Added `start()` method to being listening for callback to prevent callback
     listeners from timing out.
   * fix(server): Fixed bug with unavailable HTTP server port being used.
   * fix(jwt): Improved error message when secret file is not a valid private key.
   * chore: Updated dependencies.

 * **v1.7.2** - 1/6/2021

   * fix: Removed double encoding of switch org redirect param.

 * **v1.7.1** - 1/5/2021

   * fix: Added missing `get-port` dependency.

 * **v1.7.0** - 1/5/2021

   * refactor: Merged the AMPLIFY Auth SDK into the AMPLIFY SDK as to promote code sharing and
     prevent the Auth SDK from having platform specific knowledge.
   * feat(server): Added support for redirecting to a select organization page in the web browser
     after getting the token.
   * chore: Updated dependencies.

 * **v1.6.0** - 12/1/2020

   * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
   * chore: Updated dependencies.

 * **v1.5.3** - 11/18/2020

   * chore: Updated dependencies.

 * **v1.5.2** - 11/13/2020

   * fix(auth): Don't load account session when doing a manual login.

 * **v1.5.1** - 11/10/2020

   * chore: Updated dependencies.

 * **v1.5.0** - 10/26/2020

   * feat(ti): Added query string `params` argument to `ti.setApp()`.

 * **v1.4.0** - 10/21/2020

   * feat: Added `region` to org info.
   * chore: Updated AMPLIFY CLI references to Axway CLI.
     ([CLI-100](https://jira.axway.com/browse/CLI-100))
   * chore: Updated dependencies.

 * **v1.3.0** - 10/1/2020

   * feat: Added proxy server support. ([CLI-98](https://jira.axway.com/browse/CLI-98))
   * feat: Added `auth.findSession()` helper that is the same as `auth.loadSession()` except it does
     not persist the newly loaded account in the token store.
   * refactor: Switched from using `got` directly to `amplify-request`.
   * fix: Added missing `coverage` and `docs` npm scripts.
   * fix: Switched to launching the web browser to switch org instead of via API.
   * fix: Fallback to token and delete sid if server call returned a 401 unauthorized due to the sid
     becoming stale.
   * chore: Updated dependencies.

 * **v1.2.1** - 8/31/2020

   * fix: Fixed misspelled property.

 * **v1.2.0** - 8/28/2020

   * feat: Improved error messages.
   * feat: Added server error response `code` to exceptions.
   * fix: Added Titanium app `name` to list of required build verify parameters.
   * fix: Added missing `fingerprint_description` and `org_id` to build verify request parameters.

 * **v1.1.0** - 8/6/2020

   * chore: Updated dependencies.

 * **v1.0.6** - 7/24/2020

   * feat: Added `entitlements` to the org data.
   * chore: Updated dependencies.

 * **v1.0.5** - 7/2/2020

   * fix: Fixed fetching org info where account does not have a platform account.
   * chore: Updated dependencies.

 * **v1.0.4** - 6/12/2020

   * chore: Updated dependencies.

 * **v1.0.3** - 6/9/2020

   * chore: Updated dependencies.

 * **v1.0.2** - 5/19/2020

   * feat(login): Added support for `force` option to bypass the already authenticated check.
   * fix(switch-org): Refresh platform account details after switching org.
   * fix: Removed 2FA flag as it is no longer used.
   * chore: Updated dependencies.

 * **v1.0.1** - 5/8/2020

   * chore: Updated dependencies.

 * **v1.0.0** - 5/2/2020

   * Initial release.

### axway-cli-oum

 * **v1.1.3** - 5/11/2021

   * chore: Updated dependencies.

 * **v1.1.2** - 4/29/2021

   * doc: Improved help verbiage.
   * chore: Updated dependencies.

 * **v1.1.1** - 4/28/2021

   * chore: Updated dependencies.

 * **v1.1.0** - 4/27/2021

   * feat: Added `roles` command to org and team user management commands.
   * fix: Fallback to the selected org when the default org in the Axway CLI config is stale.
     ([CLI-121](https://jira.axway.com/browse/CLI-121))
   * chore: Updated dependencies.

 * **v1.0.0** - 4/21/2021

   * Initial release.
   * Org, team, and user management CLI. ([CLI-108](https://jira.axway.com/browse/CLI-108))