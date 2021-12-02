# v2.0.3 (Dec 2, 2021)

 * chore: Updated dependencies.

# v2.0.2 (Nov 5, 2021)

 * chore: Updated dependencies.

# v2.0.1 (Oct 18, 2021)

 * chore: Updated dependencies.

# v2.0.0 (Sep 24, 2021)

 * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
   ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
 * refactor: Renamed `axway team add` command to `axway team create` and added `add` as an alias.
 * refactor: Removed `bin` from package.
 * refactor: Moved `initPlatformAccount()` to `@axway/amplify-cli-utils`.
 * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
   ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
 * feat: Added support to activity and usage methods for selecting a date range by month.
   ([APIGOV-19922](https://jira.axway.com/browse/APIGOV-19922))
 * fix(org:view): Always show teams section even if there are no teams.
 * fix: Properly validate account name and error when a service account is specified.
   ([APIGOV-19678](https://jira.axway.com/browse/APIGOV-19678))
 * chore: Updated dependencies.

# v1.2.0 (Jul 30, 2021)

 * feat(org:view): Show list of org teams.
 * fix(activity): Render activity changes correctly.
   ([APIGOV-19215](https://jira.axway.com/browse/APIGOV-19215))
 * fix(org:usage): Support for package bundles and unlimited SaaS.
   ([APIGOV-19513](https://jira.axway.com/browse/APIGOV-19513))
 * fix(util): Fixed typo in platform account assertion.
 * chore(org:view): Removed child organizations from `org view`.

# v1.1.3 (May 11, 2021)

 * chore: Updated dependencies.

# v1.1.2 (Apr 29, 2021)

 * doc: Improved help verbiage.
 * chore: Updated dependencies.

# v1.1.1 (Apr 28, 2021)

 * chore: Updated dependencies.

# v1.1.0 (Apr 27, 2021)

 * feat: Added `roles` command to org and team user management commands.
 * fix: Fallback to the selected org when the default org in the Axway CLI config is stale.
   ([CLI-121](https://jira.axway.com/browse/CLI-121))
 * chore: Updated dependencies.

# v1.0.0 (Apr 21, 2021)

 * Initial release.
 * Org, team, and user management CLI. ([CLI-108](https://jira.axway.com/browse/CLI-108))
