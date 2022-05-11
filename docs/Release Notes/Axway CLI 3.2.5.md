# Axway CLI 3.2.5

## May 11, 2022

This is a patch release with bug fixes and minor dependency updates.

### Installation

```
npm i -g axway@3.2.5
```

### axway

 * **v3.2.5** - 5/11/2022

   * chore: Updated dependencies.

### amplify-cli-utils

 * **v5.0.9** - 5/11/2022

   * chore: Updated dependencies.

### amplify-config

 * **v4.0.9** - 5/11/2022

   * chore: Updated dependencies.

### amplify-request

 * **v3.0.9** - 5/11/2022

   * chore: Updated dependencies.

### amplify-sdk

 * **v3.2.5** - 5/11/2022

   * fix(auth): Don't redirect to org select when identity provider is 360.
     ([APIGOV-21467](https://jira.axway.com/browse/APIGOV-21467))
   * fix(login): Restrict platform service accounts to the org which owns the service account.
     ([APIGOV-22543](https://jira.axway.com/browse/APIGOV-22543))
   * fix(login): Invalid account if authentication succeeds, but loading the session fails.
   * chore: Updated dependencies.

### amplify-utils

 * **v1.0.9** - 5/11/2022

   * chore: Updated dependencies.

### axway-cli-auth

 * **v3.3.5** - 5/11/2022

   * fix(switch): Restict platform tooling accounts from being able to switch orgs since the
     associated service account can only access the org for which it belongs to.
     ([APIGOV-22543](https://jira.axway.com/browse/APIGOV-22543))
   * chore: Updated dependencies.

### axway-cli-oum

 * **v2.0.9** - 5/11/2022

   * chore: Updated dependencies.

### axway-cli-pm

 * **v4.0.9** - 5/11/2022

   * chore: Updated dependencies.