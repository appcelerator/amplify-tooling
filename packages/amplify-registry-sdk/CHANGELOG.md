# v2.2.6 (Nov 18, 2020)

 * chore: Updated dependencies.

# v2.2.5 (Nov 13, 2020)

 * fix: Check correct status code to determine if package is found.

# v2.2.4 (Nov 12, 2020)

 * chore: Updated dependencies.

# v2.2.3 (Nov 12, 2020)

 * fix: Added npm install error output to thrown error.

# v2.2.2 (Nov 12, 2020)

 * chore: Updated dependencies.

# v2.2.1 (Nov 10, 2020)

 * fix: Removed package migration from AMPLIFY CLI to Axway CLI. Packages must be reinstalled.
 * chore: Updated dependencies.

# v2.2.0 (Oct 21, 2020)

 * chore: Updated AMPLIFY CLI references to Axway CLI. Note that the internal registry SDK's
   internal `cache` and `packages` directories have moved from `~/.axway/amplify-cli` to
   `~/.axway/axway-cli`. ([CLI-100](https://jira.axway.com/browse/CLI-100))
 * chore: Updated dependencies.

# v2.1.2 (Oct 1, 2020)

 * fix: Removed `preferGlobal` package setting.
 * fix: Added back proxy server support. ([CLI-98](https://jira.axway.com/browse/CLI-98))
 * refactor: Switched from using `got` directly to `amplify-request`.

# v2.1.1 (Aug 27, 2020)

 * chore: Updated dependencies.

# v2.1.0 (Aug 6, 2020)

 * refactor: Moved cache and packages directories from `~/.axway` to `~/.axway/amplify-cli`.

# v2.0.2 (Jul 24, 2020)

 * chore: Updated dependencies.

# v2.0.1 (Jul 2, 2020)

 * chore: Updated dependencies.

# v2.0.0 (Jun 12, 2020)

 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * feat: Added `managed` flag to package info to identify packages installed via AMPLIFY Package
   Manager and manually registered packages.
 * chore: Updated dependencies.
