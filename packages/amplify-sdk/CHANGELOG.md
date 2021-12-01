# v3.1.0

 * feat: Added current `team` to authenticated platform account object.
 * fix: Fixed retrieving list of roles implicitly using the org from the account object.
 * fix: Updated Axway ID preprod endpoint.
 * chore: Updated dependencies.

# v3.0.2 (Nov 5, 2021)

 * feat(auth): Add flag to validate and refresh accounts before returning the list of accounts.
   ([APIGOV-20857](https://jira.axway.com/browse/APIGOV-20857))
 * fix(telemetry): Switched from `fork()` to `spawn()` when sending telemetry to fix issue with
   arrow key ansi escape sequences from being printed instead of cycling through the shell history.
   ([APIGOV-20863](https://jira.axway.com/browse/APIGOV-20863))
 * chore: Updated dependencies.

# v3.0.1 (Oct 18, 2021)

 * fix(auth): Only include the env in the authenticated account hash when the env is not
   production. ([APIGOV-20704](https://jira.axway.com/browse/APIGOV-20704))
 * chore: Updated dependencies.

# v3.0.0 (Sep 24, 2021)

 * BREAKING CHANGE: Require Node.js 12.13.0 LTS or newer.
   ([APIGOV-19220](https://jira.axway.com/browse/APIGOV-19220))
 * refactor: Replaced `appcd-*` libraries with `@axway/amplify-utils`.
   ([APIGOV-20264](https://jira.axway.com/browse/APIGOV-20264))
 * feat: Added `telemetry` to help improve Axway products.
   ([APIGOV-19209](https://jira.axway.com/browse/APIGOV-19209))
 * feat: Added options to filter available roles by `client`, `default`, and `org`.
 * feat: Added support to activity and usage methods for selecting a date range by month.
   ([APIGOV-19922](https://jira.axway.com/browse/APIGOV-19922))
 * fix: Removed redundant platform account and team assertions.
 * fix(auth): Use authenticated account's baseUrl and realm when logging out.
 * fix(auth): Add ability to find an authenticated account by name or hash.
 * fix(auth): Resolve environment name when creating an auth client.
 * chore: Updated dependencies.

# v2.2.0 (Jul 30, 2021)

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

# v2.1.5 (May 11, 2021)

 * fix: Set correct user agent for platform calls.

# v2.1.4 (May 10, 2021)

 * fix(auth): Pass the `AmplifySDK` `got` instance into the `Auth` class so that it can pass it
   along to the `Authentication` class. ([CLI-124](https://jira.axway.com/browse/CLI-124))
 * fix: Added missing `interactiveLoginTimeout` param to login.

# v2.1.3 (Apr 29, 2021)

 * chore: Republishing 2.1.2 because it was published out-of-band and lerna is confused.

# v2.1.2 (Apr 28, 2021)

 * fix: Ensure user roles is always an array in the event the current user is not a member of an
   organization being found.
 * fix: Remove 401 unauthorized check and assume any error should trigger a retry using the access
   token.

# v2.1.1 (Apr 28, 2021)

 * fix: Use `parseInt()` instead of an operator to cast an org id to an integer.
   ([CLI-121](https://jira.axway.com/browse/CLI-121))

# v2.1.0 (Apr 27, 2021)

 * fix(token-store): Updated `keytar` from v7.6.0 to v7.7.0, which now uses N-API. The Amplify SDK
   no longer needs to install `keytar` at runtime which solves npm 7 related issues.
 * fix(login): Validate token auth code before redirecting the browser to select the organization.
 * chore: Updated dependencies.

# v2.0.0 (Apr 21, 2021)

 * BREAKING CHANGE: Removed MBS and Titanium app development APIs.
   ([CLI-110](https://jira.axway.com/browse/CLI-110))
 * feat: Added organization and user management APIs.
   ([CLI-108](https://jira.axway.com/browse/CLI-108))
 * feat: Added HTTP status code to error messages.
 * fix(auth): Gracefully handle fetch user info request failures.
   ([CLI-118](https://jira.axway.com/browse/CLI-118))
 * fix(auth): Handle authentication that does not return a refresh token.
   ([CLI-119](https://jira.axway.com/browse/CLI-119))
 * feat(auth): Added `onOpenBrowser` callback param to login, switch, and logout methods.
   ([CLI-116](https://jira.axway.com/browse/CLI-116))
 * chore: Updated `keytar` from v7.4.0 to v7.6.0.
 * chore: Updated dependencies.

# v1.8.3 (Jan 22, 2021)

 * fix: Added missing `realm` environment defaults.

# v1.8.2 (Jan 20, 2021)

 * fix: Removed `orgSelectUrl` and appended the org select path to `platformUrl`.
 * fix(logout): Launch web browser to logout of session for platform accounts.
 * chore: Updated dependencies.

# v1.8.1 (Jan 14, 2021)

 * fix: Sort the list of authenticated accounts by name.

# v1.8.0 (Jan 11, 2021)

 * feat: Added `isPlatform` flag to authenticated accounts.
 * fix(server): Added `start()` method to being listening for callback to prevent callback
   listeners from timing out.
 * fix(server): Fixed bug with unavailable HTTP server port being used.
 * fix(jwt): Improved error message when secret file is not a valid private key.
 * chore: Updated dependencies.

# v1.7.2 (Jan 6, 2021)

 * fix: Removed double encoding of switch org redirect param.

# v1.7.1 (Jan 5, 2021)

 * fix: Added missing `get-port` dependency.

# v1.7.0 (Jan 5, 2021)

 * refactor: Merged the AMPLIFY Auth SDK into the AMPLIFY SDK as to promote code sharing and
   prevent the Auth SDK from having platform specific knowledge.
 * feat(server): Added support for redirecting to a select organization page in the web browser
   after getting the token.
 * chore: Updated dependencies.

# v1.6.0 (Dec 1, 2020)

 * fix: Bumped minimum Node.js requirement to 10.19.0 to prevent warnings on install.
 * chore: Updated dependencies.

# v1.5.3 (Nov 18, 2020)

 * chore: Updated dependencies.

# v1.5.2 (Nov 13, 2020)

 * fix(auth): Don't load account session when doing a manual login.

# v1.5.1 (Nov 10, 2020)

 * chore: Updated dependencies.

# v1.5.0 (Oct 26, 2020)

 * feat(ti): Added query string `params` argument to `ti.setApp()`.

# v1.4.0 (Oct 21, 2020)

 * feat: Added `region` to org info.
 * chore: Updated AMPLIFY CLI references to Axway CLI.
   ([CLI-100](https://jira.axway.com/browse/CLI-100))
 * chore: Updated dependencies.

# v1.3.0 (Oct 1, 2020)

 * feat: Added proxy server support. ([CLI-98](https://jira.axway.com/browse/CLI-98))
 * feat: Added `auth.findSession()` helper that is the same as `auth.loadSession()` except it does
   not persist the newly loaded account in the token store.
 * refactor: Switched from using `got` directly to `amplify-request`.
 * fix: Added missing `coverage` and `docs` npm scripts.
 * fix: Switched to launching the web browser to switch org instead of via API.
 * fix: Fallback to token and delete sid if server call returned a 401 unauthorized due to the sid
   becoming stale.
 * chore: Updated dependencies.

# v1.2.1 (Aug 31, 2020)

 * fix: Fixed misspelled property.

# v1.2.0 (Aug 28, 2020)

 * feat: Improved error messages.
 * feat: Added server error response `code` to exceptions.
 * fix: Added Titanium app `name` to list of required build verify parameters.
 * fix: Added missing `fingerprint_description` and `org_id` to build verify request parameters.

# v1.1.1 (Aug 27, 2020)

 * fix: Make Titanium build verify `ipaddress` optional.
 * chore: Updated dependencies.

# v1.1.0 (Aug 6, 2020)

 * chore: Updated dependencies.

# v1.0.6 (Jul 24, 2020)

 * feat: Added `entitlements` to the org data.
 * chore: Updated dependencies.

# v1.0.5 (Jul 2, 2020)

 * fix: Fixed fetching org info where account does not have a platform account.
 * chore: Updated dependencies.

# v1.0.4 (Jun 12, 2020)

 * chore: Updated dependencies.

# v1.0.3 (Jun 9, 2020)

 * chore: Updated dependencies.

# v1.0.2 (May 19, 2020)

 * feat(login): Added support for `force` option to bypass the already authenticated check.
 * fix(switch-org): Refresh platform account details after switching org.
 * fix: Removed 2FA flag as it is no longer used.
 * chore: Updated dependencies.

# v1.0.1 (May 8, 2020)

 * chore: Updated dependencies.

# v1.0.0 (May 2, 2020)

 * Initial release.
