# v2.4.0

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
