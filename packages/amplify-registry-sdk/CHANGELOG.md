# v2.3.6 (Apr 21, 2021)

 * style: Verbiage change.
 * chore: Updated dependencies.

# v2.3.5 (Jan 22, 2021)

 * chore: Updated dependencies.

# v2.3.4 (Jan 20, 2021)

 * chore: Updated dependencies.

# v2.3.3 (Jan 14, 2021)

 * chore: Updated dependencies.

# v2.3.2 (Jan 11, 2021)

 * fix: Remove "prepare" script from package's `package.json` before installing npm dependencies to
   prevent npm 7 from erroring due to only production dependencies being installed.
 * chore: Updated dependencies.

# v2.3.1 (Jan 5, 2021)

 * chore: Updated dependencies.

# v2.3.0 (Dec 1, 2020)

 * feat: Added `path` to installed package info.
 * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
 * fix: Removed dependency on appcd-subprocess.

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
