# AMPLIFY Auth SDK

The AMPLIFY Auth SDK for Node.js makes it easy for Node.js applications to authenticate with
AxwayID in order to access AMPLIFY Services.

> :warning: DEPRECATION WARNING
>
> The AMPLIFY Auth SDK has be integrated into the [AMPLIFY SDK][amplify-sdk]. You should use that
> package instead: npm i @axway/amplify-sdk

## Compatibility

Auth SDK v2 changed the structure of the data in the token store, but some dependencies still rely
on Auth SDK v1. To ensure other CLI's won't break, Auth SDK v2 will write the accounts in both the
v1 and v2 formats.

Note that Auth SDK v1 is unaware of the v2 token store and thus revoking an account using Auth SDK
v1 will only affect the credentials stored in the v1 token store.

## Installation

	npm i @axway/amplify-auth-sdk --save

## Overview

There are 4 supported authentication methods:

 * Resource Owner Accounts:
   - Authorization Code Grant with PKCE (Proof Key for Code Exchange)
   - Username/Password
 * Service Accounts:
   - Client Secret Credentials
   - JSON Web Token

The Auth SDK supports being authenticated into multiple accounts simultaneously regardless of the
authentication method. Each account is uniquely identified by its account name and base URL.

## Features

 * Support for multiple authentication methods
 * Persists tokens in a local store
 * Optional support for secure token storage
 * Custom token store support
 * Ability to simultaneously authentication into multiple environments with different credentials
   and authentication methods
 * Built-in web server for interactive login flows
 * Customizable interactive success message

### Persistence

Access tokens are persisted in a token store. The type of token store is specified at the time the
`Auth` instance is created. Possible types are:

 * `"auto"` (default) - Attempts to create the best token store.
 * `"secure"` - A secure file-based store.
 * `"file"` - An unsecure file-based store.
 * `"memory"` - An in-memory store.
 * `null` - No store will be created and tokens will not be persisted.

By default, the Auth SDK will use the `"auto"` token store which attempts to create a `"secure"`
token store, but falls back to a file-based store followed by an in-memory store should that fail.

Both `"secure"` and `"file"` token stores require a `tokenStoreDir` value. The directory will be
created if it does not exist.

The secure store requires the [`keytar`](https://www.npmjs.com/package/keytar) dependency. `keytar`
is a native Node.js C++ addon and thus requires a C++ compiler to be installed on the user's machine
at the time this Auth SDK is installed. Since users may not have a compiler available, it is
recommended that `keytar` be an optional dependency.

> :bulb: When using keytar and a user changes their Node.js version to a different major version, the
> module API version for which keytar was compiled for will no longer be compatible and the Auth SDK
> fail to operate.

The `"memory"` token store will persist the tokens for the life of the process and are lost when the
process exits. This was originally intended for unit tests.

> :warning: Tokens that do not have an email address in the payload cannot be persisted. The email
> address is used as the account name and a unique identifier when attempting to get the token in
> the store. It is up to the consumer to [securely] persist the tokens.

## Examples

### Authorization Code Grant with PKCE

PKCE is the default authentication method. It requires user interaction using a web browser to
complete the authentication process.

```js
import Auth from '@axway/amplify-auth-sdk';

(async function main() {
	const auth = new Auth({
		clientId: 'my_app',
		realm: 'realm_to_auth_into'
	});

	// this will launch the default browser and wait for the user to complete the process
	const account = await auth.login();

	console.log(`Authenticated successfully ${account.name}!`);
})().catch(console.error);
```

You can also manually authenticate manually without a browser.

> Note: Manual authentication will spin up a local HTTP server for the redirects. Manual mode is
> intended for headless environments.

```js
import Auth from '@axway/amplify-auth-sdk';
import got from 'got';

(async function main() {
	const auth = new Auth({
		clientId: 'my_app',
		realm: 'realm_to_auth_into'
	});

	const { url } = await auth.login({ manual: true });
  const res = await got(url, { followRedirect: false });
  const code = new URL(res.headers.get('location')).searchParams.get('code');
	const account = await auth.login({ code });

	console.log(`Authenticated successfully ${account.name}!`);
})().catch(console.error);
```

### Username/Password

```js
import Auth from '@axway/amplify-auth-sdk';

(async function main() {
	const auth = new Auth({
		clientId: 'my_app',
		realm: 'realm_to_auth_into',
		username: 'tester',
		password: 'password1'
	});

	const account = await auth.login();

	console.log(`Authenticated successfully ${account.name}!`);
})().catch(console.error);
```

### Client Secret Credentials

```js
import Auth from '@axway/amplify-auth-sdk';

(async function main() {
	const auth = new Auth({
		clientId: 'my_app',
		realm: 'realm_to_auth_into',
		clientSecret: '63b320e4-752e-452a-9066-a168f6f6c201'
	});

	// this will launch the default browser and wait for the user to complete the process
	const account = await auth.login();

	console.log(`Authenticated successfully ${account.name}!`);
})().catch(console.error);
```

### JSON Web Token

```js
import Auth from '@axway/amplify-auth-sdk';

(async function main() {
	const auth = new Auth({
		clientId: 'my_app',
		realm: 'realm_to_auth_into',
		secretFile: '/path/to/rsa-private-key.pem'
	});

	const account = await auth.login();

	console.log(`Authenticated successfully ${account.name}!`);
})().catch(console.error);
```

## API

### `new Auth(options)`

Creates a new `Auth` instance. This class facilitates authentication, reporting tokens, and revoking
tokens.

A single `Auth` instance can be used to authenticate multiple accounts regardless of the
authentication method.

> Note: Should your application create more than one `Auth` instance, it is recommended that you
> manually create a single token store and pass it into each `Auth` instance.

#### `options`: (Object)

Aside from the token store related options, the options are stored as "default" values that are
used when a method is invoked and a property has not be specified.

 * General:
   * `baseUrl`: (String) [optional] The base URL to use for all outgoing requests.
   * `clientId`: (String) **[required]** The client id to specify when authenticating.
   * `env`: (String) [optional] The environment name. Must be `"dev"`, `"preprod"`, or `"prod"`. The
     environment is a shorthand way of specifying a Axway default base URL. Defaults to `"prod"`.
   * `secureServiceName`: (String) [optional] The name of the consumer using this library when using
     the `"secure"` token store. Defaults to `"Axway AMPLIFY Auth"`.
   * `messages`: (Object) [optional] A map of categorized messages to display to the end user.
     Supports plain text or HTML strings.
   * `realm`: (String) **[required]** The name of the realm to authenticate with.
   * `tokenRefreshThreshold`: (Number) [optional] The number of seconds before the access token
     expires and should be refreshed. Defaults to `0`.
   * `tokenStore`: (TokenStore) [optional] A token store instance for persisting the tokens.
   * `tokenStoreDir`: (String) [optional] The directory where the token store is saved. Required
     when the `tokenStoreType` is `secure` or `file`.
   * `tokenStoreType`: (String) [optional] The type of store to persist the access token.
     Possible values include: `"auto"`, `"secure"`, `"file"`, or `"memory"`. If value is `auto`, it
     will attempt to use `secure`, then `file`, then `memory`. If set to `null`, then it will not
     persist the access token. Defaults `"secure"`.
 * PKCE:
   * This is the default authentication method and has no options.
 * Username/Password:
   * `username`: (String) [optional] The username to login as.
   * `password`: (String) [optional] The password use.
 * Client Secret Credentials:
   * `clientSecret`: (String) [optional] The client-specific secret key to login with.
   * `serviceAccount`: (Boolean) [optional] When `true`, indicates the consumer is a service and not
     a user and that authentication should be _non-interactive_.
 * JSON Web Token:
   * `secretFile`: (String) [optional] The path to the file containing the secret key to login
     with. This is RSA private key, usually stored in a `.pem` file.

### Methods

#### `find(options)`

Retrieves the access token based on the supplied account name.

##### `options`: (Object)

 * `accountName`: (String) The account name to retrieve.
 * `authenticator`: (Authenticator) [optional] An authenticator instance to use. If not specified,
   one will be auto-selected based on the options.
 * `baseUrl`: (String) [optional] The base URL to filter by.

##### Return Value

Returns a `Promise` that resolves an `Object` containing:

 * `auth`: (Object) Authentication related info.
 * `auth.authenticator`: (String) The authentication method.
 * `auth.baseUrl`: (String) The base URL.
 * `auth.env`: (String) The environment name. Note that a user may override the environment's base URL.
 * `auth.expired`: (Boolean) This is a computed property that determimes if the access token is expired.
   Auth SDK consumers should check this after retreiving the account to see if they need to
   re-authenticate by calling `login()`.
 * `auth.expires`: (Object) An object containing a timestamp (in milliseconds) for which the `access` and
 * `auth.realm`: (String) The OpenID realm.
   `auth.refresh` tokens expire.
 * `auth.tokens`: (Object) The original OpenID tokens object.
 * `hash`: (String) A base64 encoded md5 hash of the authenticator parameters.
 * `name`: (String) The account name. Generally this is the user's email address.

If the account is not found or if the `tokenStoreType` has been explicitly set to `null`, it will
resolve `null`.

##### Example

```js
const account = await auth.find({ accountName: 'foo@bar.com' });
if (account) {
	if (account.expired) {
		console.log(`Found ${account.name}, but the access token is expired and you must call login() again`);
	} else {
		console.log(`Found ${account.name}`);
	}
} else {
	console.log('Not found');
}
```

#### `list()`

Returns a list of all valid access tokens.

##### Return Value

Returns a `Promise` that resolves an `Array` of account objects (as described in `find()`).

If the `tokenStoreType` has been explicitly set to `null`, it will resolve an empty array.

##### Example

```js
const accounts = await auth.list();
console.log(`Found ${accounts.length} accounts`);
```

#### `login(options)`

Determines the appropriate authentication method and begins the authentication method login process.

For PKCE or non-service client secret, it will start a local http server and launch the default web
browser with the Axway login page. Once the user has logged in, the Axway platform will redirect the
browser to the local http server and continue the authentication process.

All other authentication methods are non-interactive and pass along the parameters specified in the
`Auth()` constructor to complete the authentication process.

If the account is already in the token store with valid access and refresh tokens, then it is
returned instead of going through the authentication process unless the `code` option is specified.
If the `code` is passed in, it is assumed that effort was made to retrieve the code and thus the
intention was to get fresh tokens.

##### `options`: (Object) [optional]

 * General:
   * `accessType`: (String) [optional] The access type to send with requests. Defaults to
     `"offline"`.
   * `app`: (String|Array) [optional] Specify the app to open the `target` with, or an array with
     the app and app arguments. Defaults to the system default web browser.
   * `authenticator`: (Authenticator) [optional] An authenticator instance to use. If not specified,
     one will be auto-selected based on the options.
   * `clientId`: (String) **[required]** The client id to specify when authenticating.
   * `code`: (String) [optional] The authentication code from a successful interactive login.
   * `endpoints`: (Object) [optional] A map of endpoint names to endpoint URLs. Possible endpoints
     are: `"auth"`, `"certs"`, `"logout"`, `"token"`, `"userinfo"`, and `"wellKnown"`.
   * `interactiveLoginTimeout`: (Number) [optional] The number of milliseconds to wait before
     shutting down the local HTTP server. Defaults to `120000`.
   * `manual`: (Boolean) [optional] When the authentication method is interactive and manual is
     `true` it will return the auth URL instead of starting the local web server and launching the
     web browser. It is then up to the consumer to connect to the URL, login, and retrieve the auth
     code. Defaults to `false`.
   * `responseType`: (String) [optional] The response type to send with requests. Defaults to
     `"code"`.
   * `scope`: (String) [optional] The name of the scope to send with requests. Defaults to
     `"openid"`.
   * `serverHost`: (String) [optional] The local HTTP server hostname or IP address to listen on
     when interactively authenticating. Defaults to `"127.0.0.1"`.
   * `serverPort`: (Number) [optional] The local HTTP server port to listen on when interactively
     authenticating. Defaults to `3000`
   * `timeout`: (Number) [optional] The number of milliseconds to wait before timing out. Defaults
     to the `interactiveLoginTimeout` property.
   * `wait`: (Boolean) [optional] Wait for the opened app to exit before fulfilling the promise. If
     `false` it's fulfilled immediately when opening the app. Defaults to `false`.

Each of the following authentication method specific options override the default values defined
in the `Auth` constructor. If no default values have been defined, then the following options are
required.

 * PKCE:
   * This is the default authentication method and has no options.
 * Username/Password:
   * `username`: (String) The username to login as.
   * `password`: (String) The password use.
 * Client Secret Credentials:
   * `clientSecret`: (String) The client-specific secret key to login with.
   * `serviceAccount`: (Boolean) [optional] When `true`, indicates the consumer is a service and not
     a user and that authentication should be _non-interactive_.
 * JSON Web Token:
   * `secretFile`: (String) The path to the file containing the secret key to login
     with. This is RSA private key, usually stored in a `.pem` file.

##### Return Value

Returns a `Promise` that resolves an `Object`. The contents of that object depends on whether
`manual=true`.

If `manual`, the resolved object contains:

 * `cancel()`: (Function) A function that cancels the interactive login request and stops the local
   HTTP server.
 * `promise`: (Promise) Resolves an `Object` containing the `accessToken` if authentication
   succeeds.
 * `url`: (String) The URL to call that when successful should return a 301 redirect to the local
   HTTP server containing the authorization code used to retreive the access token when calling
   `login({ code })`.

If *NOT* `manual`, it resolves an `account` info object as described in the `find()` return value
description.

##### Example

```js
const account = await auth.login();
console.log(`Account name = ${account.name}`);
console.log(`Access token = ${account.auth.tokens.access_token}`);
console.log('User info =', account.user);
console.log('Org info =', account.org);
```

#### `logout(options)`

Invalidates all or specific account access tokens by name.

##### `options`: (Object)

 * `accounts`: (Array|String) A single account or array of accounts to revoke.
 * `all`: (Boolean) Revokes all account access tokens. Supercedes `accounts` option.
 * `baseUrl`: (String) [optional] The base URL used to filter accounts.

##### Return Value

Returns a `Promise` that resolves an `Array` of revoked accounts.

> Note: If all accounts have been revoked, the token store implementation generally removes the
> entire store rather than keep an empty store.

This function will always succeed regardless if it the Axway platform was able to invalidate the
access token.

##### Example

```js
const revoked = await auth.logout({ accounts: [ 'foo@bar.com' ] });
console.log(`Revoked ${revoked.length} accounts`);
```

```js
const revoked = await auth.logout({ all: true });
console.log(`Revoked ${revoked.length} accounts`);
```

### Advanced Methods

#### `createAuthenticator(options)`

Determines which authenticator should be used based on the supplied options, then creates an
instance of that authenticator.

This method can be directly invoked, but the recommended usage is to call `login()` instead.
However, if you have some advanced scenario, this method may come in handy. Note that this method
only applies the supplied options and not the default options of the `Auth` instance.

 * General:
   * `authenticator`: (Authenticator) [optional] An authenticator instance to use. If not specified,
     one will be auto-selected based on the options.
 * PKCE:
   * This is the default authentication method and has no options.
 * Username/Password:
   * `username`: (String) The username to login as.
   * `password`: (String) The password use.
 * Client Secret Credentials:
   * `clientSecret`: (String) The client-specific secret key to login with.
   * `serviceAccount`: (Boolean) [optional] When `true`, indicates the consumer is a service and not
     a user and that authentication should be _non-interactive_.
 * JSON Web Token:
   * `secretFile`: (String) The path to the file containing the secret key to login
     with. This is RSA private key, usually stored in a `.pem` file.

##### Return Value

Returns either a `ClientSecret`, `OwnerPassword`, `PKCE` or `SignedJWT` authenticator instance.

#### `serverInfo(url)`

Discovers available endpoints based on the remote server's OpenID configuration.

 * `url`: (String) [optional]  An URL to discover the available endpoints. Defaults to the URL
   derived from the `baseUrl`.

##### Return Value

Returns a `Promise` that resolves an `Object` containing information about the authentication
endpoint.

## Internal APIs

The `Auth` class is a convenience wrapper around a specific authenticator implementation. This SDK
exports all internal classes for authenticators and token stores.

These implementation specific authentication and token store classes can be used directly, but
generally for testing or defining new authentication and token store classes.

### Authenticators

 * `Authenticator`: The base class for all authenticators.
   * `ClientSecret`: The client secret authenticator.
   * `OwnerPassword`: The username/password authenticator.
   * `PKCE`: The PKCE authenticator.
   * `SignedJWT`: The JSON web token authenticator.

### Token Stores

 * `TokenStore`: The base class for all token stores.
   * `FileStore`: The default file-based token store.
   * `MemoryStore`: An in-memory token store.
   * `SecureStore`: A secure token store that uses [`keytar`](https://www.npmjs.com/package/keytar).

### Misc Internal APIs

 * `environments`: (Object) Default environment settings.
 * `getEndpoints({ baseUrl, realm } )`: Constructs an object containing all endpoints for the given
   `baseUrl` and `realm`.
 * `server`: An object with a methods for starting and stopping the local HTTP server.

#### `server.stop(force, serverIds)`

Stops the local HTTP interactive login callback server. This can be called by consumers to abort all
interactive logins.

 * `force`: (Boolean) When `true`, it will stop the server regardless if there are any pending
   interactive logins or connections. Any pending interactive requests will be rejected.
 * `serverIds`: (String|Array<String>) A list of server ids to stop. A server id is defined by
   `"<server_host>:<server_port>"`. By default, all servers are stopped.

##### Return Value

Returns a `Promise` when all connections have been disconnected and the HTTP server(s) have been
stopped.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-auth-sdk/LICENSE
[amplify-sdk]: https://npmjs.com/package/@axway/amplify-sdk
