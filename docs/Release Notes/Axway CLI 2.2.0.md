# Axway CLI 2.2.0

## Jul 30, 2021

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g axway@2.2.0
```

### axway

 * **v2.2.0** - 7/30/2021

   * feat: Checks if any installed CLI extension packages have updates available and prints them
     at the end of a command whenever the banner is rendered.
     ([APIGOV-19210](https://jira.axway.com/browse/APIGOV-19210))
   * chore: Added unsupported architecture and 32-bit architecture deprecation warning to banner.
     ([CLI-130](https://jira.axway.com/browse/CLI-130))
   * doc: Added "install Axway Central CLI" to post install next steps verbiage.
     ([CLI-128](https://jira.axway.com/browse/CLI-128))
   * style: Adjusted error rendering.

### amplify-cli-auth

 * **v2.7.0** - 7/30/2021

   * feat: Add support for authenticating into a service account, then upgrade to a platform account
     using the platform tooling credentials.
     ([APIGOV-19229](https://jira.axway.com/browse/APIGOV-19229))
   * fix(switch): Add support for switching org for platform tooling accounts.
     ([APIGOV-19370](https://jira.axway.com/browse/APIGOV-19370))
   * fix: Remove `--service` flag and treat `--client-secret` auth flows to be headless.

### amplify-cli-utils

 * **v4.4.0** - 7/30/2021

   * feat: Added `hlVer()` function to render version difference.
   * chore: Updated dependencies.

### amplify-config

 * **v3.1.0** - 7/30/2021

   * feat: Updated `config-kit` and `appcd-fs` to add support for applying parent directory
     ownership when being executed as sudo.
     ([APIGOV-19102](https://jira.axway.com/browse/APIGOV-19102))

### amplify-sdk

 * **v2.2.0** - 7/30/2021

   * feat: Add support for authenticating into a service account, then upgrade to a platform account
     using the platform tooling credentials.
     ([APIGOV-19229](https://jira.axway.com/browse/APIGOV-19229))
   * feat: Updated `appcd-fs` to add support for applying parent directory ownership when being
     executed as sudo. ([APIGOV-19102](https://jira.axway.com/browse/APIGOV-19102))
   * feat: Added list of teams to find org info.
   * feat: Added new function to get entitlement info which is used by the org usage report to
     populate bundle metric names. ([APIGOV-19513](https://jira.axway.com/browse/APIGOV-19513))
   * fix(switch): Added `isPlatformTooling` flag to properly handle logging out of a platform tooling
     account. ([APIGOV-19370](https://jira.axway.com/browse/APIGOV-19370))
   * fix: Validate team argument for user add, list, and update commands.
     ([APIGOV-19216](https://jira.axway.com/browse/APIGOV-19216))
   * fix(teams): Allow team user management commands to case insensitive match team name or guid and
     match user by email address or guid.
     ([APIGOV-19105](https://jira.axway.com/browse/APIGOV-19105))
   * fix: Parse activity and usage dates using current locale.
   * fix: Fixed platform URL reference in switch org logic.
   * chore: Removed child organizations from organization info. Platform has deprecated parent/child
     organizations. This also solves an issue where users of child orgs cannot view the parent org.

### axway-cli-oum

 * **v1.2.0** - 7/30/2021

   * feat(org:view): Show list of org teams.
   * fix(activity): Render activity changes correctly.
     ([APIGOV-19215](https://jira.axway.com/browse/APIGOV-19215))
   * fix(org:usage): Support for package bundles and unlimited SaaS.
     ([APIGOV-19513](https://jira.axway.com/browse/APIGOV-19513))
   * fix(util): Fixed typo in platform account assertion.
   * chore(org:view): Removed child organizations from `org view`.

### axway-cli-pm

 * **v3.0.0** - 7/30/2021

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