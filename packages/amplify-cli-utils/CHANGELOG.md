# v5.0.7

 * chore: Updated dependencies.

# v5.0.6 (Feb 2, 2022)

 * fix: Use "staging" name instead of "preprod".
 * chore: Updated dependencies.

# v5.0.5 (Jan 14, 2022)

 * chore: Updated dependencies.

# v5.0.4 (Dec 21, 2021)

 * fix: Initialize default token refresh threshold to 15 minutes.
   ([APIGOV-20729](https://jira.axway.com/browse/APIGOV-20729))
 * fix: Fixed bug where falsey config values were being overwritten by config file values.
 * chore: Updated dependencies.

# v5.0.3 (Dec 2, 2021)

 * chore: Updated dependencies.

# v5.0.2 (Nov 5, 2021)

 * chore: Updated dependencies.

# v5.0.1 (Oct 18, 2021)

 * chore: Updated dependencies.

# v5.0.0 (Sep 24, 2021)

 * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
   ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
 * refactor: Added `initPlatformAccount()` from `@axway/axway-cli-oum`.
 * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
   ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
 * feat: Added `telemetry` to help improve Axway products.
   ([APIGOV-19209](https://jira.axway.com/browse/APIGOV-19209))
 * feat: Added environment titles.
 * feat: Added helper function to resolve the environment specific auth config key.
 * feat: Added environment argument to platform account initialization.
 * chore: Updated dependencies.

# v4.4.0 (Jul 30, 2021)

 * feat: Added `hlVer()` function to render version difference.
 * chore: Updated dependencies.

# v4.3.4 (May 11, 2021)

 * fix: Prevent table padding from being styled despite there being no border.
 * chore: Updated dependencies.

# v4.3.3 (Apr 29, 2021)

 * chore: Updated dependencies.

# v4.3.2 (Apr 28, 2021)

 * chore: Updated dependencies.

# v4.3.1 (Apr 27, 2021)

 * chore: Updated dependencies.

# v4.3.0 (Apr 21, 2021)

 * feat: Added `isHeadless()` helper function.
 * feat: Autodetect if headless and force token store type to `file`.
   ([CLI-116](https://jira.axway.com/browse/CLI-116))
 * chore: Updated dependencies.

# v4.2.5 (Jan 22, 2021)

 * chore: Updated dependencies.

# v4.2.4 (Jan 20, 2021)

 * chore: Updated dependencies.

# v4.2.3 (Jan 11, 2021)

 * chore: Updated dependencies.

# v4.2.2 (Jan 11, 2021)

 * chore: Updated dependencies.

# v4.2.1 (Jan 5, 2021)

 * chore: Updated dependencies.

# v4.2.0 (Dec 1, 2020)

 * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
 * chore: Updated dependencies.

# v4.1.4 (Nov 18, 2020)

 * chore: Updated dependencies.

# v4.1.3 (Nov 13, 2020)

 * chore: Updated dependencies.

# v4.1.2 (Nov 12, 2020)

 * chore: Updated dependencies.

# v4.1.1 (Nov 12, 2020)

 * chore: Updated dependencies.

# v4.1.0 (Nov 10, 2020)

 * feat: Added API for checking if update is available.
   ([CLI-22](https://jira.axway.com/browse/CLI-22))
 * chore: Updated dependencies.

# v4.0.0 (Oct 21, 2020)

 * BREAKING CHANGE: Updated AMPLIFY CLI references to Axway CLI. The config file was moved from
   `~/.axway/amplify-cli/amplify-cli.json` to `~/.axway/axway-cli/config.json`.
   ([CLI-100](https://jira.axway.com/browse/CLI-100))
 * chore: Updated dependencies.

# v3.2.0 (Oct 1, 2020)

 * feat: Added HTTP request helpers for preparing proxy config and creating a `got` instance.
   ([CLI-98](https://jira.axway.com/browse/CLI-98))
 * fix: Removed `preferGlobal` package setting.
 * refactor: Renamed `buildParams()` to `buildAuthParams()` to be more clear on purpose.
 * chore: Updated dependencies.

# v3.1.1 (Aug 27, 2020)

 * style: Update table style.
 * chore: Updated dependencies.

# v3.1.0 (Aug 6, 2020)

 * refactor: Moved AMPLIFY CLI config file from `~/.axway` to `~/.axway/amplify-cli`.

# v3.0.6 (Jul 24, 2020)

 * chore: Updated dependencies.

# v3.0.5 (Jul 2, 2020)

 * chore: Updated dependencies.

# v3.0.4 (Jun 12, 2020)

 * chore: Updated dependencies.

# v3.0.3 (Jun 9, 2020)

 * chore: Updated dependencies.

# v3.0.2 (May 19, 2020)

 * chore: Updated dependencies.

# v3.0.1 (May 5, 2020)

 * fix: Added missing AMPLIFY SDK dependency.

# v3.0.0 (May 5, 2020)

 * BREAKING CHANGE: Dropped support for Node.js 10.12.0 and older.
   ([CLI-89](https://jira.axway.com/browse/CLI-89))
 * BREAKING CHANGE: Removed `auth` APIs. Use `initSDK()` and the resulting `sdk.auth.*` methods.
 * BREAKING CHANGE: Added `@appcd/amplify-sdk` for authentication and platform integration.
   ([DAEMON-324](https://jira.appcelerator.org/browse/DAEMON-324))
 * BREAKING CHANGE: AMPLIFY Auth SDK v2 (via AMPLIFY SDK) changed structure of `account` info by
   moving auth-related info into an `auth` property.
 * feat: Added `initSDK()` helper that loads the AMPLIFY CLI config and initializes an AMPLIFY SDK
   instance.
 * feat: Added support for environment synonyms such as "production" for "prod".
   ([CLI-87](https://jira.axway.com/browse/CLI-87))
 * chore: Removed unused `appcd-config` dependency.
 * chore: Updated dependencies.
