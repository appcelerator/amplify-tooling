# v2.4.1 (Jan 6, 2021)

 * fix(uninstall): Switched to `cross-spawn` to find and run `npm` on Windows.

# v2.4.0 (Jan 5, 2021)

 * feat(purge,uninstall): Added support for running a package's npm uninstall script.
 * chore: Updated dependencies.

# v2.3.1 (Dec 3, 2020)

 * fix(uninstall): Remove empty package container directories.
 * fix(uninstall): Fixed issue uninstalling package with a label in the package version.
 * fix(use): Fixed issue with selecting a package with a label in the package version.
 * style: Prefix error message with an X symbol.

# v2.3.0 (Dec 1, 2020)

 * feat: Added `axway:pm:*` actions for `install`, `purge`, `uninstall`, `update`, and `use`
   commands. ([CLI-105](https://jira.axway.com/browse/CLI-105))
 * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
 * fix(use): Return all package info when `--json` flag is set.

# v2.2.7 (Nov 18, 2020)

 * chore: Updated dependencies.

# v2.2.6 (Nov 13, 2020)

 * chore: Updated dependencies.

# v2.2.5 (Nov 12, 2020)

 * chore: Updated dependencies.

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

 * fix: Added back proxy server support.
 * fix: Removed `preferGlobal` package setting.
 * style: Cleaned up verbiage in descriptions.
 * chore: Updated dependencies.

# v2.1.1 (Aug 27, 2020)

 * chore: Updated dependencies.

# v2.1.0 (Aug 6, 2020)

 * style: Adopted Axway style guide for tables.
 * chore: Updated dependencies.

# v2.0.2 (Jul 24, 2020)

 * chore: Updated dependencies.

# v2.0.1 (Jul 2, 2020)

 * fix: Set several command aliases to hidden.
 * chore: Updated dependencies.

# v2.0.0 (Jun 12, 2020)

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
