# v2.0.0-rc2 (Nov 9, 2020)

 * Initial release of the Axway CLI, formerly AMPLIFY CLI.
   ([CLI-100](https://jira.axway.com/browse/CLI-100))
 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
   `push`, or `unshift`.
 * BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
   instead.
 * BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
 * feat: Bundled `node-pty-prebuilt-multiarch` which cli-kit will use to spawn non-cli-kit
   extensions using a pseudo terminal and preserve stdio for things such as prompting.
 * feat(config): Added proxy info to config help.
 * feat: Added notificaiton if new version is available.
   ([CLI-22](https://jira.axway.com/browse/CLI-22))
 * refactor(config): Do not show the banner for `config` related commands.
 * refactor(config): Replaced config action with subcommands for cleaner code and improved help
   information.
 * fix(config): Latest cli-kit no longer requires `showHelpOnError` to be disabled.
 * chore: Updated dependencies.
