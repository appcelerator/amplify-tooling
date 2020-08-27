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
