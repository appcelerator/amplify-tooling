# AMPLIFY CLI 2.0.0

## Unreleased

This is a major release with breaking changes, new features, bug fixes, and dependency updates.

### Installation

```
npm i -g @axway/amplify-cli@2.0.0
```

### amplify-cli@2.0.0

 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
   `push`, or `unshift`.
 * BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
   instead.
 * BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
 * refactor(config): Do not show the banner for `config` related commands.
 * refactor(config): Replaced config action with subcommands for cleaner code and improved help
   information.
 * fix(config): Latest cli-kit no longer requires `showHelpOnError` to be disabled.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.0.0

 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * BREAKING CHANGE: Changed structure of `account` info by moving auth-related info into an `auth`
   property.
 * BREAKING CHANGE: No longer populate org info after login or getting token from store. Logic was
   moved to the AMPLIFY SDK.
 * BREAKING CHANGE: Removed `Auth.switchOrg()`. Logic has been moved to AMPLIFY SDK.
 * BREAKING CHANGE: Removed `Auth.sendAuthCode()` and support for two factor authentication.
 * BREAKING CHANGE: `Auth.getAccount()` has been renamed to `Auth.find()`.
 * BREAKING CHANGE: `Auth.revoke()` has been renamed to `Auth.logout()`.
 * refactor: Replaced `@axway/amplify-request` with [`got`](https://www.npmjs.com/package/got).
 * feat: Browser redirects to platform dashboard upon successful login.
 * feat: Added `Auth.updateAccount()` method to store updated account (after populating org info) in token store.
 * feat: Added support for environment synonyms such as "production" for "prod".
   ([CLI-87](https://jira.axway.com/browse/CLI-87))
 * fix: Removed deprecated URL parsing.
 * chore: Fixed lint issues, namely around Node.js `URL` deprecations.
 * chore: Updated keytar from v5.0.0 to v5.6.0.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.0.1

 * fix: Fixed typo when referencing account's refresh token's expiration.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.0.2

 * fix(file-store): Update token store on disk if an expired token has been purged.

### amplify-auth-sdk@2.0.3

 * fix: Improved `got` request error handling.
 * fix: Fixed major bug where the authenticator hash was being computed before the criteria needed
   to compute the hash was defined.
 * fix: Allow `env` to be a string or environment object.
 * chore: Added more debug logging.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.0.4

 * fix(signed-jwt): Fixed JWT expiration to be seconds, not milliseconds.

### amplify-auth-sdk@2.1.0

 * style(secure-store): Added keytar version to error message.
 * chore: Updated keytar from v5.6.0 to v6.0.1.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.1.1

 * chore: Updated dependencies.

### amplify-auth-sdk@2.1.2

 * fix: Fixed bug when fetching user info and a non-HTTP error occurs where the error object does
   not have an HTTP response.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.1.3

 * fix: Added token store backwards compatibility by writing both a v2 and v1 versions of the token
   store. See readme for details.
 * fix: Copy options object so the original reference isn't modified.
 * fix: `env` in the account object was the resolved environment settings including URLs instead of
   just the environment name.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.2.0

 * refactor(secure-store): Moved keytar file from `~/.axway/lib` to `~/.axway/amplify-cli/lib`.
 * refactor(file-store): Moved token store file from `~/.axway` to `~/.axway/amplify-cli`.
 * chore: Updated dependencies.

### amplify-auth-sdk@2.2.1

 * chore: Updated dependencies.

### amplify-cli-auth@2.0.0

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

### amplify-cli-auth@2.0.1

 * fix: Set the logout command's "revoke" alias to hidden.
 * chore: Updated dependencies.

### amplify-cli-auth@2.0.2

 * chore: Updated dependencies.

### amplify-cli-auth@2.0.3

 * fix: Fixed bug in `switch` command which was using the org name instead of the org id.

### amplify-cli-auth@2.1.0

 * style: Adopted Axway style guide for tables.
 * chore: Updated dependencies.

### amplify-cli-auth@2.2.1

 * chore: Updated dependencies.

### amplify-cli-pm@2.0.0

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

### amplify-cli-pm@2.0.1

 * fix: Set several command aliases to hidden.
 * chore: Updated dependencies.

### amplify-cli-pm@2.0.2

 * chore: Updated dependencies.

### amplify-cli-pm@2.1.0

 * style: Adopted Axway style guide for tables.
 * chore: Updated dependencies.

### amplify-cli-pm@2.2.1

 * chore: Updated dependencies.

### amplify-cli-utils@3.0.0

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

### amplify-cli-utils@3.0.1

 * fix: Added missing AMPLIFY SDK dependency.

### amplify-cli-utils@3.0.2

 * chore: Updated dependencies.

### amplify-cli-utils@3.0.3

 * chore: Updated dependencies.

### amplify-cli-utils@3.0.4

 * chore: Updated dependencies.

### amplify-cli-utils@3.0.5

 * chore: Updated dependencies.

### amplify-cli-utils@3.0.6

 * chore: Updated dependencies.

### amplify-cli-utils@3.1.0

 * refactor: Moved AMPLIFY CLI config file from `~/.axway` to `~/.axway/amplify-cli`.

### amplify-cli-utils@3.1.1

 * style: Update table style.
 * chore: Updated dependencies.

### amplify-config@2.0.0

 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * refactor: Replaced `appcd-config` with `config-kit`.
 * chore: Updated dependencies.

### amplify-config@2.0.1

 * chore: Updated dependencies.

### amplify-config@2.0.2

 * chore: Updated dependencies.

### amplify-config@2.0.3

 * chore: Updated dependencies.

### amplify-config@2.1.0

 * refactor: Moved AMPLIFY CLI config file from `~/.axway` to `~/.axway/amplify-cli`.
 * chore: Updated dependencies.

### amplify-config@2.1.1

 * fix: Update extension paths in config file when migrating to new AMPLIFY CLI home directory.

### amplify-config@2.1.2

 * No changes. Lerna forced version bump.

### amplify-registry-sdk@2.0.0

 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * feat: Added `managed` flag to package info to identify packages installed via AMPLIFY Package
   Manager and manually registered packages.
 * chore: Updated dependencies.

### amplify-registry-sdk@2.0.1

 * chore: Updated dependencies.

### amplify-registry-sdk@2.0.2

 * chore: Updated dependencies.

### amplify-registry-sdk@2.1.0

 * refactor: Moved cache and packages directories from `~/.axway` to `~/.axway/amplify-cli`.

### amplify-registry-sdk@2.1.1

 * chore: Updated dependencies.

### amplify-sdk@1.0.0

 * Initial release.

### amplify-sdk@1.0.1

 * chore: Updated dependencies.

### amplify-sdk@1.0.2

 * feat(login): Added support for `force` option to bypass the already authenticated check.
 * fix(switch-org): Refresh platform account details after switching org.
 * fix: Removed 2FA flag as it is no longer used.
 * chore: Updated dependencies.

### amplify-sdk@1.0.3

 * chore: Updated dependencies.

### amplify-sdk@1.0.4

 * chore: Updated dependencies.

### amplify-sdk@1.0.5

 * fix: Fixed fetching org info where account does not have a platform account.
 * chore: Updated dependencies.

### amplify-sdk@1.0.6

 * feat: Added `entitlements` to the org data.
 * chore: Updated dependencies.

### amplify-sdk@1.1.0

 * chore: Updated dependencies.

### amplify-sdk@1.1.1

 * fix: Make Titanium build verify `ipaddress` optional.
 * chore: Updated dependencies.