# v4.0.3

 * chore: Updated dependencies.

# v4.0.2 (Nov 5, 2021)

 * chore: Updated dependencies.

# v4.0.1 (Oct 18, 2021)

 * chore: Updated dependencies.

# v4.0.0 (Sep 24, 2021)

 * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
   ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
 * refactor: Removed `bin` from package.
 * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
   ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
 * fix(view): Fixed filtering package properties when outputting as JSON.
 * fix(view): Improve error handling when package name is invalid.
 * doc: Added additional information to `axway pm` help output.
 * chore: Updated dependencies.

# v3.0.0 (Jul 30, 2021)

 * feat: Updated `appcd-fs` to add support for applying parent directory ownership when being
   executed as sudo. ([APIGOV-19102](https://jira.axway.com/browse/APIGOV-19102))
 * feat: `purge` and `update` commands will show the affected packages and prompt to continue. Also
   added the `-y, --yes` flag to bypass the prompt.
 * refactor: Renamed package from `@axway/amplify-cli-pm` to `@axway/axway-cli-pm`.
 * refactor: Removed registry server integration in favor of querying npm directly.
   ([CLI-111](https://jira.axway.com/browse/CLI-111))
 * fix(install): Show package name and version during install steps.
   ([CLI-126](https://jira.axway.com/browse/CLI-126))
 * fix(view): Return `null` instead of `undefined` when specifying `--json` if package not found.
 * fix(install): Fixed bug where race condition would overwrite a registered CLI extensions when
   installing multiple packages.
 * chore: Updated dependencies.

# v2.5.4 (May 11, 2021)

 * chore: Updated dependencies.

# v2.5.3 (Apr 29, 2021)

 * chore: Updated dependencies.

# v2.5.2 (Apr 28, 2021)

 * chore: Updated dependencies.

# v2.5.1 (Apr 27, 2021)

 * chore: Updated dependencies.

# v2.5.0 (Apr 21, 2021)

 * feat(install): Show the command to use the newly installed CLI extension.
   ([CLI-68](https://jira.axway.com/browse/CLI-68))
 * fix: Properly output errors when `--json` flag is set.
 * fix(update): Show package name and version during install steps.
   ([CLI-109](https://jira.axway.com/browse/CLI-109))
 * chore: Updated dependencies.

# v2.4.5 (Jan 22, 2021)

 * chore: Updated dependencies.

# v2.4.4 (Jan 20, 2021)

 * chore: Updated dependencies.

# v2.4.3 (Jan 14, 2021)

 * chore: Updated dependencies.

# v2.4.2 (Jan 11, 2021)

 * chore: Updated dependencies.

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
