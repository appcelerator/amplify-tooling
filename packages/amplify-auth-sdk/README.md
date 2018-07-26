# Amplify Auth SDK

The Amplify Auth SDK for Node.js makes it easy for Node.js applications to authenticate with
AxwayID in order to access Amplify Services.

## Installation

	npm i @axway/amplify-auth-sdk --save
	npm i keytar --save-optional

## Overview

There are 4 supported authentication methods:

 * Resource Owner Accounts:
   - Authorization Code Grant with PKCE (Proof Key for Code Exchange)
   - Username/Password
 * Service Accounts:
   - Client Secret Credentials
   - JSON Web Token

The token can be persisted across program execution. By default, the token is stored in a file. You
can optionally install [`keytar`](https://www.npmjs.com/package/keytar) to securely store the token
in the operating system's secure storage mechanism (keychain, libsecret, or credential vault).

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
	const { accessToken } = await auth.login();

	console.log('Authenticated successfully!');
	console.log(await auth.userinfo());
})().catch(console.error);
```

You can also manually authenticate manually without a browser.

```js
import Auth from '@axway/amplify-auth-sdk';
import fetch from 'node-fetch';
import querystring from 'querystring';
import url from 'url';

(async function main() {
	const auth = new Auth({
		clientId: 'my_app',
		realm: 'realm_to_auth_into'
	});

	const { url } = await auth.login({ manual: true });
	const res = await fetch(url, { redirect: 'manual' });
	const { code } = querystring.parse(url.parse(res.headers.get('location')).query);
	const { accessToken } = await auth.login({ code });

	console.log('Authenticated successfully!');
	console.log(await auth.userinfo());
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

	const { accessToken } = await auth.login();

	console.log('Authenticated successfully!');
	console.log(await auth.userinfo());
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
	const { accessToken } = await auth.login();

	console.log('Authenticated successfully!');
	console.log(await auth.userinfo());
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

	const { accessToken } = await auth.login();

	console.log('Authenticated successfully!');
	console.log(await auth.userinfo());
})().catch(console.error);
```

## API

### `new Auth(options)`

Creates a new Auth instance. The authentication method is implicitly determined based on the options
passed into the constructor.

#### `options`: (Object)

 * Global:
   * `accessType`: (String) [optional] The access type to send with requests. Defaults to
     `"offline"`.
   * `baseUrl`: (String) [optional] The base URL to use for all outgoing requests.
   * `clientId`: (String) **[required]** The client id to specify when authenticating.
   * `endpoints`: (Object) [optional] A map of endpoint names to endpoint URLs. Possible endpoints
     are: `"auth"`, `"certs"`, `"logout"`, `"token"`, `"userinfo"`, and `"wellKnown"`.
   * `env`: (String) [optional] The environment name. Must be `"dev"`, `"preprod"`, or `"prod"`. The
     environment is a shorthand way of specifying a Axway default base URL. Defaults to `"prod"`.
   * `interactiveLoginTimeout`: (Number) [optional] The number of milliseconds to wait before
     shutting down the local HTTP server. Defaults to `120000`.
   * `keytarServiceName`: (String) [optional] The name of the consumer using this library when using
     the `"keytar"` token store. Defaults to `"amplify-auth"`.
   * `messages`: (Object) [optional] A map of categorized messages to display to the end user.
     Supports plain text or HTML strings.
   * `realm`: (String) **[required]** The name of the realm to authenticate with.
   * `responseType`: (String) [optional] The response type to send with requests. Defaults to
     `"code"`.
   * `scope`: (String) [optional] The name of the scope to send with requests. Defaults to
     `"openid"`.
   * `serverHost`: (String) [optional] The local HTTP server hostname or IP address to listen on
     when interactively authenticating. Defaults to `"127.0.0.1"`.
   * `serverPort`: (Number) [optional] The local HTTP server port to listen on when interactively
     authenticating. Defaults to `3000`
   * `tokenRefreshThreshold`: (Number) [optional] The number of seconds before the access token
     expires and should be refreshed. Defaults to `0`.
   * `tokenStore`: (TokenStore) [optional] A token store instance for persisting the tokens.
   * `tokenStoreDir`: (String) [optional] The directory to save the token file when the `default`
     token store is used.
   * `tokenStoreType`: (String) [optional] The type of store to persist the access token. Possible
     values include: `auto` (which tries to use the `keytar` store, but falls back to the default
     store), [`keytar`](https://www.npmjs.com/package/keytar) to use the operating system's secure
     storage mechanism (or errors if keytar is not installed), or `default` to use the built-in
     store. If `null`, it will not persist the access token.
 * PKCE:
   * This is the default authentication method and has no options.
 * Username/Password:
   * `username`: (String) **[required]** The username to login as.
   * `password`: (String) **[required]** The password use.
 * Client Secret Credentials:
   * `clientSecret`: (String) **[required]** The client-specific secret key to login with.
   * `serviceAccount`: (Boolean) [optional] When `true`, indicates the consumer is a service and not
     a user and that authentication should be _non-interactive_.
 * JSON Web Token:
   * `secretFile`: (String) **[required]** The path to the file containing the secret key to login
     with. This is RSA private key, usually stored in a `.pem` file.

### Properties

#### `expiresIn`: (Number)

Returns the number of milliseconds from January 1, 1970 00:00:00 UTC for which the access token
expires. This allows consumers to set a timer to `auth.expiresIn - Date.now()` to trigger a status
notification.

### Methods

#### `getAccessToken(doLogin)`

Retrieves the access token. If the machine has not authenticated yet, it will attempt to login. If
the authentication method is interactive (PKCE or non-service client secret), then it will throw an
error.

 * `doLogin`: (Boolean) [optional] When `true`, and non-interactive, it will attempt to log in using
   the refresh token. Defaults to `false`.

##### Return Value

Returns `Promise<String>` that resolves the access token.

#### `login(options)`

Begins the authentication method login process.

For PKCE or non-service client secret, it will start a local http server and launch the default web
browser with the Axway login page. Once the user has logged in, the Axway platform will redirect the
browser to the local http server and continue the authentication process.

All other authentication methods are non-interactive and pass along the parameters specified in the
`Auth()` constructor to complete the authentication process.

##### `options`: (Object) [optional]

 * `app`: (String|Array) [optional] Specify the app to open the `target` with, or an array with the
   app and app arguments. Defaults to the system default web browser.
 * `code`: (String) [optional] The authentication code from a successful interactive login.
 * `manual`: (Boolean) [optional] When the authentication method is interactive and manual is `true`
   it will return the auth URL instead of starting the local web server and launching the web
   browser. It is then up to the consumer to connect to the URL, login, and retrieve the auth code.
   Defaults to `false`.
 * `timeout`: (Number) [optional] The number of milliseconds to wait before timing out. Defaults to
   the `interactiveLoginTimeout` property.
 * `wait`: (Boolean) [optional] Wait for the opened app to exit before fulfilling the promise. If
   `false` it's fulfilled immediately when opening the app. Defaults to `false`.

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

If *NOT* `manual`, the resolved object contains:

 * `accessToken`: The access token when authentication succeeds.

#### `logout()`

Invalidates the access token.

##### Return Value

Returns `Promise` that resolves once the local access token and the remote session have been
invalidated. This function will always succeed regardless if it the Axway platform was able to
invalidate the access token.

#### `userInfo(doLogin)`

Retrieves the user info associated with the access token. If the machine has not authenticated yet,
it will attempt to login. If the authentication method is interactive (PKCE or non-service client
secret), then it will throw an error.

 * `doLogin`: (Boolean) [optional] When `true`, and non-interactive, it will attempt to log in using
   the refresh token. Defaults to `false`.

##### Return Value

Returns `Promise` that resovles an `Object` containing the associated user information.

##### Example

```js
(async function main() {
	const auth = new Auth({
		clientId: 'my_app',
		realm: 'realm_to_auth_into'
	});

	console.log(await auth.userinfo(true));
})().catch(console.error);
```

### Advanced Methods

#### `serverInfo(url)`

Discovers available endpoints based on the remote server's OpenID configuration.

 * `url`: (String) [optional]  An URL to discover the available endpoints. Defaults to the URL
   derived from the `baseUrl`.

##### Return Value

Returns `Promise` that resolves an `Object` containing information about the authentication
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
   * `KeytarStore`: A secure token store that uses [`keytar`](https://www.npmjs.com/package/keytar).

### Misc Internal APIs

 * `server`: An object with a methods for starting and stopping the local HTTP server.

#### `server.stop(force, serverIds)`

Stops the local HTTP interactive login callback server. This can be called by consumers to abort all
interactive logins.

 * `force`: (Boolean) When `true`, it will stop the server regardless if there are any pending
   interactive logins or connections. Any pending interactive requests will be rejected.
 * `serverIds`: (String|Array<String>) A list of server ids to stop. A server id is defined by
   `"<server_host>:<server_port>"`. By default, all servers are stopped.

##### Return Value

Returns `Promise` when all connections have been disconnected and the HTTP server(s) have been
stopped.

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-auth-sdk/LICENSE
