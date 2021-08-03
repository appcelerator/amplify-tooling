# v3.0.0

 * refactor: Renamed package from `@axway/amplify-cli-auth` to `@axway/axway-cli-auth`.

# v2.7.0 (Jul 30, 2021)

 * feat: Add support for authenticating into a service account, then upgrade to a platform account
   using the platform tooling credentials.
   ([APIGOV-19229](https://jira.axway.com/browse/APIGOV-19229))
 * fix(switch): Add support for switching org for platform tooling accounts.
   ([APIGOV-19370](https://jira.axway.com/browse/APIGOV-19370))
 * fix: Remove `--service` flag and treat `--client-secret` auth flows to be headless.

# v2.6.4 (May 11, 2021)

 * fix: Added environment name to `axway auth list`.
 * style(login): Removed extra blank line when authenticating with username and password.
 * chore: Updated dependencies.

# v2.6.3 (Apr 29, 2021)

 * doc: Improved help verbiage.

# v2.6.2 (Apr 28, 2021)

 * chore: Updated dependencies.

# v2.6.1 (Apr 27, 2021)

 * chore: Updated dependencies.

# v2.6.0 (Apr 21, 2021)

 * feat: Publicly expose the `whoami` command.
 * feat(login): Added feedback when launching the web browser for an interactive login.
   ([CLI-79](https://jira.axway.com/browse/CLI-79))
 * feat: Improved handling of headless environments.
   ([CLI-116](https://jira.axway.com/browse/CLI-116))
 * fix: Properly output errors when `--json` flag is set.
 * chore: Updated dependencies.

# v2.5.4 (Jan 22, 2021)

 * chore: Updated dependencies.

# v2.5.3 (Jan 20, 2021)

 * chore: Updated dependencies.

# v2.5.2 (Jan 14, 2021)

 * fix(list): Fixed display of account type.
 * fix(switch): Allow service accounts to be selected as the default, but skip the org selection.

# v2.5.1 (Jan 13, 2021)

 * fix(login): Display gracefully message when logging in with `--no-launch-browser` and you are
   already logged in.

# v2.5.0 (Jan 11, 2021)

 * feat(list): Added platform flag to account list.
 * fix(login): Don't show the banner during login when `--json` is set.
 * fix(login): Support service accounts when logging in with `--no-launch-browser`.
 * fix(login): Fixed verbiage when logging in using a service account.
 * fix(login): Removed reference to AMPLIFY CLI.
 * fix(switch): Only allow users to switch org for authenticated platform accounts.
 * chore: Updated dependencies.

# v2.4.0 (Jan 5, 2021)

 * refactor(switch): Reworked the `switch` command to use the web browser to switch the org instead
   of prompting.
 * style: Prefixed more error messages with an X symbol.

# v2.3.1 (Dec 3, 2020)

 * style: Prefix error message with an X symbol.

# v2.3.0 (Dec 1, 2020)

 * feat: Added `axway:auth:*` actions for `login`, `logout`, and `switch` commands.
   ([CLI-105](https://jira.axway.com/browse/CLI-105))
 * fix: Added missing AMPLIFY SDK init parameters to `logout` and `whoami` commands.
 * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.

# v2.2.4 (Nov 18, 2020)

 * chore: Updated dependencies.

# v2.2.5 (Nov 13, 2020)

 * fix(login): Fixed logged in message after logging in using a service account which has no
   platform organization.
 * fix(login): Load session after manually logging in.

# v2.2.4 (Nov 12, 2020)

 * chore: Updated dependencies.

# v2.2.3 (Nov 12, 2020)

 * chore: Updated dependencies.

# v2.2.2 (Nov 10, 2020)

 * chore: Updated dependencies.

# v2.2.1 (Oct 21, 2020)

 * chore: Updated AMPLIFY CLI references to Axway CLI.
   ([CLI-100](https://jira.axway.com/browse/CLI-100))
 * chore: Updated dependencies.

# v2.2.0 (Oct 1, 2020)

 * fix(login): Added missing `--service` login flag when using `--client-secret`.
 * fix(login): Added missing `--base-url`, `--client-id`, and `--realm` login arguments.
 * fix(switch): Fixed initial selected account and org when prompting.
 * fix: Removed `preferGlobal` package setting.
 * style: Cleaned up verbiage in descriptions.
 * chore: Updated dependencies.

# v2.1.2 (Aug 27, 2020)

 * fix(login): Fixed bug where login would default to the username flow instead of the pkce flow.

# v2.1.1 (Aug 27, 2020)

 * chore: Updated dependencies.

# v2.1.0 (Aug 6, 2020)

 * style: Adopted Axway style guide for tables.
 * chore: Updated dependencies.

# v2.0.3 (Aug 3, 2020)

 * fix: Fixed bug in `switch` command which was using the org name instead of the org id.

# v2.0.2 (Jul 24, 2020)

 * chore: Updated dependencies.

# v2.0.1 (Jul 2, 2020)

 * fix: Set the logout command's "revoke" alias to hidden.
 * chore: Updated dependencies.

# v2.0.0 (Jun 12, 2020)

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
