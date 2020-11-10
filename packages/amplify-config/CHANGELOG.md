# v3.0.2 (Nov 10, 2020)

 * fix: Removed migration of extensions due to issues if command is cancelled while copying.
 * chore: Updated dependencies.

# v3.0.1 (Oct 26, 2020)

 * fix: Copy extension packages during first time migration from AMPLIFY CLI structure.
   ([CLI-103](https://jira.axway.com/browse/CLI-103))

# v3.0.0 (Oct 21, 2020)

 * BREAKING CHANGE: Updated AMPLIFY CLI references to Axway CLI. The config file was moved from
   `~/.axway/amplify-cli/amplify-cli.json` to `~/.axway/axway-cli/config.json`.
   ([CLI-100](https://jira.axway.com/browse/CLI-100))

# v2.1.3 (Oct 1, 2020)

 * fix: Removed `preferGlobal` package setting.

# v2.1.2 (Aug 27, 2020)

 * No changes. Lerna forced version bump.

# v2.1.1 (Aug 6, 2020)

 * fix: Update extension paths in config file when migrating to new AMPLIFY CLI home directory.

# v2.1.0 (Aug 6, 2020)

 * refactor: Moved AMPLIFY CLI config file from `~/.axway` to `~/.axway/amplify-cli`.
 * chore: Updated dependencies.

# v2.0.3 (Jul 24, 2020)

 * chore: Updated dependencies.

# v2.0.2 (Jul 2, 2020)

 * chore: Updated dependencies.

# v2.0.1 (Jun 12, 2020)

 * chore: Updated dependencies.

# v2.0.0 (May 5, 2020)

 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * refactor: Replaced `appcd-config` with `config-kit`.
 * chore: Updated dependencies.
