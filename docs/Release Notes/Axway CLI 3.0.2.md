# Axway CLI 3.0.2

## Nov 05, 2021

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g axway@3.0.2
```

### axway

 * **v3.0.2** - 11/5/2021

   * chore: Updated dependencies.

### amplify-cli-utils

 * **v5.0.2** - 11/5/2021

   * chore: Updated dependencies.

### amplify-config

 * **v4.0.2** - 11/5/2021

   * chore: Updated dependencies.

### amplify-request

 * **v3.0.2** - 11/5/2021

   * chore: Updated dependencies.

### amplify-sdk

 * **v3.0.2** - 11/5/2021

   * feat(auth): Add flag to validate and refresh accounts before returning the list of accounts.
     ([APIGOV-20857](https://jira.axway.com/browse/APIGOV-20857))
   * fix(telemetry): Switched from `fork()` to `spawn()` when sending telemetry to fix issue with
     arrow key ansi escape sequences from being printed instead of cycling through the shell history.
     ([APIGOV-20863](https://jira.axway.com/browse/APIGOV-20863))
   * chore: Updated dependencies.

### amplify-utils

 * **v1.0.2** - 11/5/2021

   * chore: Updated dependencies.

### axway-cli-auth

 * **v3.1.0** - 11/5/2021

   * feat: Display region after logging in and on auth list and whoami commands.
     ([APIGOV-16634](https://jira.axway.com/browse/APIGOV-16634))
   * fix: Validate that accounts have not been invalidated when listing authenticated accounts.
     ([APIGOV-20857](https://jira.axway.com/browse/APIGOV-20857))
   * fix(switch): Fixed function reference when saving switched org when using a service account that
     uses a platform tooling account. ([APIGOV-20757](https://jira.axway.com/browse/APIGOV-20757))
   * chore: Updated dependencies.

### axway-cli-oum

 * **v2.0.2** - 11/5/2021

   * chore: Updated dependencies.

### axway-cli-pm

 * **v4.0.2** - 11/5/2021

   * chore: Updated dependencies.