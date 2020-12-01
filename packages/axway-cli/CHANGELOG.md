# v2.0.0-rc9 (Dec 1, 2020)

 * Initial release of the Axway CLI, formerly AMPLIFY CLI.
   ([CLI-100](https://jira.axway.com/browse/CLI-100))
 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
   `push`, or `unshift`.
 * BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
   instead.
 * BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
 * feat(config): Added proxy info to config help.
 * feat: Added notificaiton if new version is available.
   ([CLI-22](https://jira.axway.com/browse/CLI-22))
 * feat: Added `axway:config:save` action to `config` command.
   ([CLI-105](https://jira.axway.com/browse/CLI-105))
 * refactor(config): Do not show the banner for `config` related commands.
 * refactor(config): Replaced config action with subcommands for cleaner code and improved help
   information.
 * fix(config): Latest cli-kit no longer requires `showHelpOnError` to be disabled.
 * style: Prefix error message with an X symbol.
 * chore: Updated dependencies.
