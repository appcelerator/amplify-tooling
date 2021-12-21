# Axway CLI 3.2.0

## Dec 21, 2021

This is a minor release with new features, bug fixes, and dependency updates.

### Installation

```
npm i -g axway@3.2.0
```

### axway

 * **v3.2.0** - 12/21/2021

   * fix: Fixed unhandled exception when sending crash error.
   * chore: Updated dependencies.

### amplify-cli-utils

 * **v5.0.4** - 12/21/2021

   * fix: Initialize default token refresh threshold to 15 minutes.
     ([APIGOV-20729](https://jira.axway.com/browse/APIGOV-20729))
   * fix: Fixed bug where falsey config values were being overwritten by config file values.
   * chore: Updated dependencies.

### amplify-config

 * **v4.0.4** - 12/21/2021

   * chore: Updated dependencies.

### amplify-request

 * **v3.0.4** - 12/21/2021

   * chore: Updated dependencies.

### amplify-sdk

 * **v3.2.0** - 12/21/2021

   * feat: Implemented token refresh based on configurable threshold.
     ([APIGOV-20729](https://jira.axway.com/browse/APIGOV-20729))
   * fix: Added org subscriptions to authenticated account object.
   * fix: Removed interactive login for client secret auth since it has been disabled.
   * fix: Update org name for service accounts.
   * chore: Updated dependencies.

### amplify-utils

 * **v1.0.4** - 12/21/2021

   * chore: Updated dependencies.

### axway-cli-auth

 * **v3.3.0** - 12/21/2021

   * feat: Implemented token refresh based on configurable threshold in the Amplify SDK.
     ([APIGOV-20729](https://jira.axway.com/browse/APIGOV-20729))
   * chore: Updated dependencies.

### axway-cli-oum

 * **v2.0.4** - 12/21/2021

   * chore: Updated dependencies.

### axway-cli-pm

 * **v4.0.4** - 12/21/2021

   * chore: Updated dependencies.