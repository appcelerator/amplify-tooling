# v4.0.4 (July 28, 2025)

- chore: Fixed Issue with "axway team user add" command.
  ([APIGOV-30889](https://jira.axway.com/browse/APIGOV-30889))

# v4.0.3 (July 28, 2025)

- chore: Fixed Issue with "axway org user list" command.
  ([APIGOV-30670](https://jira.axway.com/browse/APIGOV-30907))

# v4.0.2 (June 26, 2025)

- chore: Security Updates.
  - chore: Fixed Issue with "axway user credentials" command.
    ([APIGOV-30670](https://jira.axway.com/browse/APIGOV-30670))
    ([APIGOV-30622](https://jira.axway.com/browse/APIGOV-30622))

# v4.0.1 (May 16, 2025)

- BREAKING CHANGE: Node.js version upgrade to 20.18.2 (minimum) and conversion to ES Modules.
  ([APIGOV-27923](https://jira.axway.com/browse/APIGOV-29723))

# v3.2.16 (Jan 16, 2025)

- chore: Updated dependencies.

# v3.2.15 (Nov 21, 2024)

- chore: Updated dependencies.

# v3.2.14 (July 3, 2024)

- chore: Updated dependencies.

# v3.2.13 (May 31, 2024)

- chore: Updated dependencies.

# v3.2.12 (Jan 23, 2024)

- chore: Updated dependencies.

# v3.2.11 (Nov 8, 2023)

- chore: Updated dependencies.

# v3.2.10 (Nov 8, 2023)

- chore: Updated dependencies.

# v3.2.9 (Nov 8, 2023)

- chore: Updated dependencies.

# v3.2.8 (Nov 8, 2023)

- fix: Updated year to '2023' to fix the test failures.

# v3.2.7 (Jul 7, 2022)

- chore: Updated dependencies.

# v3.2.6 (Jun 30, 2022)

- chore: Updated dependencies.

# v3.2.5 (May 11, 2022)

- chore: Updated dependencies.

# v3.2.4 (Mar 28, 2022)

- chore: Updated dependencies.

# v3.2.3 (Feb 16, 2022)

- chore: Updated dependencies.

# v3.2.2 (Feb 2, 2022)

- chore: Updated dependencies.

# v3.2.1 (Jan 14, 2022)

- chore: Bumped copyright to 2022.
- chore: Updated dependencies.

# v3.2.0 (Dec 21, 2021)

- fix: Fixed unhandled exception when sending crash error.
- chore: Updated dependencies.

# v3.1.0 (Dec 2, 2021)

- fix: Don't show available updates when `--json` flag is set.
- chore: Updated dependencies.

# v3.0.2 (Nov 5, 2021)

- chore: Updated dependencies.

# v3.0.1 (Oct 18, 2021)

- chore: Updated dependencies.

# v3.0.0 (Sep 24, 2021)

- BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
  ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
- refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
  ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
- feat: Added `telemetry` to help improve Axway products.
  ([APIGOV-19209](https://jira.axway.com/browse/APIGOV-19209))
- feat: Add non-production environment title to banner.
- fix: Only error out when config file is bad when running a config command.
- refactor: Move `--env` from auth and oum CLI's to the Axway CLI.
- style: Fixed indentation of error messages.
- doc: Fixed Axway CLI documentation URL in post install message.

# v2.2.0 (Jul 30, 2021)

- feat: Checks if any installed CLI extension packages have updates available and prints them
  at the end of a command whenever the banner is rendered.
  ([APIGOV-19210](https://jira.axway.com/browse/APIGOV-19210))
- chore: Added unsupported architecture and 32-bit architecture deprecation warning to banner.
  ([CLI-130](https://jira.axway.com/browse/CLI-130))
- doc: Added "install Axway Central CLI" to post install next steps verbiage.
  ([CLI-128](https://jira.axway.com/browse/CLI-128))
- style: Adjusted error rendering.

# v2.1.0 (May 11, 2021)

- feat: Added post install welcome message.
- fix: Properly output errors when `--json` flag is set.
- chore: Added deprecation warning for Node.js 10 and older.
  ([CLI-110](https://jira.axway.com/browse/CLI-110))
- chore: Updated dependencies.

# v2.0.0 (Jan 22, 2021)

- Initial release of the Axway CLI, formerly AMPLIFY CLI.
  ([CLI-100](https://jira.axway.com/browse/CLI-100))
- BREAKING CHANGE: Require Node.js 10.19.0 or newer.
  ([CLI-89](https://jira.axway.com/browse/CLI-89))
- BREAKING CHANGE(config): `config` command does not return current value when doing a `set`,
  `push`, or `unshift`.
- BREAKING CHANGE(config): `config list` command no longer supports filtering, use `config get`
  instead.
- BREAKING CHANGE(config): Write operations such as `set` return `"OK"` instead of `"Saved"`.
- feat(config): Added proxy info to config help.
- feat: Added notificaiton if new version is available.
  ([CLI-22](https://jira.axway.com/browse/CLI-22))
- feat: Added `axway:config:save` action to `config` command.
  ([CLI-105](https://jira.axway.com/browse/CLI-105))
- refactor(config): Do not show the banner for `config` related commands.
- refactor(config): Replaced config action with subcommands for cleaner code and improved help
  information.
- fix(config): Latest cli-kit no longer requires `showHelpOnError` to be disabled.
- style: Prefix error message with an X symbol.
- chore: Updated dependencies.
