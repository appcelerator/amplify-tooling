# v3.0.5 (July 28, 2025)

- chore: Fixed Issue with "axway team user add" command.
  ([APIGOV-30889](https://jira.axway.com/browse/APIGOV-30889))

# v3.0.4 (July 28, 2025)

- chore: Fixed Issue with "axway org user list" command.
  ([APIGOV-30670](https://jira.axway.com/browse/APIGOV-30907))

# v3.0.3 (June 26, 2025)

- chore: Security Updates.
- chore: Fixed Issue with "axway user credentials" command.
  ([APIGOV-30670](https://jira.axway.com/browse/APIGOV-30670))
  ([APIGOV-30622](https://jira.axway.com/browse/APIGOV-30622))

# v3.0.2 (May 16, 2025)

- BREAKING CHANGE: Node.js version upgrade to 20.18.2 (minimum) and conversion to ES Modules.
  ([APIGOV-27923](https://jira.axway.com/browse/APIGOV-29723))

# v3.0.1 (May 16, 2025)

- BREAKING CHANGE: Node.js version upgrade to 20.18.2 (minimum) and conversion to ES Modules.
  ([APIGOV-27923](https://jira.axway.com/browse/APIGOV-29723))

# v3.0.0 (May 16, 2025)

- BREAKING CHANGE: Node.js version upgrade to 20.18.2 (minimum) and conversion to ES Modules.
  ([APIGOV-27923](https://jira.axway.com/browse/APIGOV-29723))

# v2.0.20 (Jan 16, 2025)

- chore: Updated dependencies.

# v2.0.19 (Nov 21, 2024)

- chore: Updated dependencies.

# v2.0.18 (July 3, 2024)

- chore: Updated dependencies.

# v2.0.17 (May 31, 2024)

- chore: Updated dependencies.

# v2.0.16 (Jan 23, 2024)

- chore: Updated dependencies.

# v2.0.15 (Nov 8, 2023)

- chore: Updated dependencies.

# v2.0.14 (Nov 8, 2023)

- chore: Updated dependencies.

# v2.0.13 (Nov 8, 2023)

- chore: Updated dependencies.

# v2.0.12 (Nov 8, 2023)

- chore: Updated dependencies.

# v2.0.11 (Jul 7, 2022)

- chore: Updated dependencies.

# v2.0.10 (Jun 30, 2022)

- chore: Updated dependencies.

# v2.0.9 (May 11, 2022)

- chore: Updated dependencies.

# v2.0.8 (Mar 28, 2022)

- chore: Updated dependencies.

# v2.0.7 (Feb 16, 2022)

- chore: Updated dependencies.

# v2.0.6 (Feb 2, 2022)

- chore: Updated dependencies.

# v2.0.5 (Jan 14, 2022)

- fix: Added user "type" to org user list command to match team user list.
- chore: Updated dependencies.

# v2.0.4 (Dec 21, 2021)

- chore: Updated dependencies.

# v2.0.3 (Dec 2, 2021)

- chore: Updated dependencies.

# v2.0.2 (Nov 5, 2021)

- chore: Updated dependencies.

# v2.0.1 (Oct 18, 2021)

- chore: Updated dependencies.

# v2.0.0 (Sep 24, 2021)

- BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
  ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
- refactor: Renamed `axway team add` command to `axway team create` and added `add` as an alias.
- refactor: Removed `bin` from package.
- refactor: Moved `initPlatformAccount()` to `@axway/amplify-cli-utils`.
- refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
  ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
- feat: Added support to activity and usage methods for selecting a date range by month.
  ([APIGOV-19922](https://jira.axway.com/browse/APIGOV-19922))
- fix(org:view): Always show teams section even if there are no teams.
- fix: Properly validate account name and error when a service account is specified.
  ([APIGOV-19678](https://jira.axway.com/browse/APIGOV-19678))
- chore: Updated dependencies.

# v1.2.0 (Jul 30, 2021)

- feat(org:view): Show list of org teams.
- fix(activity): Render activity changes correctly.
  ([APIGOV-19215](https://jira.axway.com/browse/APIGOV-19215))
- fix(org:usage): Support for package bundles and unlimited SaaS.
  ([APIGOV-19513](https://jira.axway.com/browse/APIGOV-19513))
- fix(util): Fixed typo in platform account assertion.
- chore(org:view): Removed child organizations from `org view`.

# v1.1.3 (May 11, 2021)

- chore: Updated dependencies.

# v1.1.2 (Apr 29, 2021)

- doc: Improved help verbiage.
- chore: Updated dependencies.

# v1.1.1 (Apr 28, 2021)

- chore: Updated dependencies.

# v1.1.0 (Apr 27, 2021)

- feat: Added `roles` command to org and team user management commands.
- fix: Fallback to the selected org when the default org in the Axway CLI config is stale.
  ([CLI-121](https://jira.axway.com/browse/CLI-121))
- chore: Updated dependencies.

# v1.0.0 (Apr 21, 2021)

- Initial release.
- Org, team, and user management CLI. ([CLI-108](https://jira.axway.com/browse/CLI-108))
