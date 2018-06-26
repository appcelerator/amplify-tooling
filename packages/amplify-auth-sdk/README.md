# Amplify Auth SDK

The Amplify Auth SDK for Node.js makes it easy for Node.js applications to authenticate with
AxwayID in order to access Amplify Services.

## Installation

	npm i @axway/amplify-auth-sdk

## Overview

There are 4 supported authentication methods:

 * Resource Owner Accounts:
   - Authorization Code Grant with PKCE
   - Username/Password
 * Service Accounts:
   - Client Secret Credentials
   - JSON Web Token

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
	await auth.login();

	console.log('Authenticated successfully!');
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

	await auth.login();

	console.log('Authenticated successfully!');
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
	await auth.login();

	console.log('Authenticated successfully!');
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

	await auth.login();

	console.log('Authenticated successfully!');
})().catch(console.error);
```

## API

### `new Auth(options)`

Creates a new Auth instance. The authentication method is implicitly determined based on the options
passed into the constructor.

#### `options`: (Object)

 * Global Options:
   * `accessType`: (String) [optional] The access type to send with requests. Defaults to
     `"offline"`.
   * `baseUrl`: (String) [optional] The base URL to use for all outgoing requests.
   * `clientId`: (String) **[required]** The client id to specify when authenticating.
   * `endpoints`: (Object) [optional] A map of endpoint names to endpoint URLs. Possible endpoints
     are: `"auth"`, `"certs"`, `"logout"`, `"token"`, `"userinfo"`, and `"wellKnown"`.
   * `env`: (String) [optional] The environment name. Must be `"dev"`, `"preprod"`, or `"prod"`. The
     environment is a shorthand way of specifying a Axway default base URL. Defaults to `"prod"`.
   * `realm`: (String) **[required]** The name of the realm to authenticate with.
   * `responseType`: (String) [optional] The response type to send with requests. Defaults to
     `"code"`.
   * `scope`: (String) [optional] The name of the scope to send with requests. Defaults to
     `"openid"`.
   * `tokenRefreshThreshold`: (Number) [optional] The number of seconds before the access token
     expires and should be refreshed. Defaults to 5 minutes (or 300 seconds).
 * Username/Password Options:
   * `username`: (String) **[required]** The username to login as.
   * `password`: (String) **[required]** The password use.
 * Client Secret Credentials
   * `clientSecret`: (String) **[required]** The client-specific secret key to login with.
   * `serviceAccount`: (Boolean) [optional] When `true`, indicates the consumer is a service and not
     a user and that authentication should be _non-interactive_.
 * JSON Web Token
   * `secretFile`: (String) **[required]** The path to the file containing the secret key to login
     with. This is RSA private key, usually stored in a `.pem` file.

### Properties

#### `expiresIn`: (Number)

Returns the number of milliseconds from January 1, 1970 00:00:00 UTC for which the access token
expires. This allows consumers to set a timer to `auth.expiresIn - Date.now()` to trigger a status
notification.

### Methods

#### `getAccessToken()`

Retrieves the access token. If the machine has not authenticated yet, it will attempt to login. If
the authentication method is interactive (PKCE or non-service client secret), then it will throw an
error.

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
 * `headless`: (Boolean) [optional] When the authentication method is interactive and headless is
   `true`, it will return the auth URL instead of starting the local web server and launching the
   web browser. It is then up to the consumer to connect to the URL, login, and retrieve the auth
   code. Defaults to `false`.
 * `wait`: (Boolean) [optional] Wait for the opened app to exit before fulfilling the promise. If
   `false` it's fulfilled immediately when opening the app. Defaults to `false`.

##### Return Value

Returns `Promise` when the authentication has completed or failed.

#### `logout()`

Invalidates the access token.

##### Return Value

Returns `Promise` that resolves once the local access token and the remote session have been
invalidated. This function will always succeed regardless if it the Axway platform was able to
invalidate the access token.

#### `userInfo()`

Retrieves the user info associated with the access token. If the machine has not authenticated yet,
it will attempt to login. If the authentication method is interactive (PKCE or non-service client
secret), then it will throw an error.

##### Return Value

Returns `Promise` that resovles an `Object` containing the associated user information.

### Advanced Methods

#### `getToken(code)`

> :warning: You should almost always use `login()` instead of `getToken()`.

This method is intended for consumers that are using interactive authentication methods and logging
in using the "headless" mode.

 * `code`: (String) [optional] The auth code returned after successfully authenticating using the
   headless interactive flow.

##### Return Value

Returns `Promise` that resolves the access token.

#### `serverInfo(url)`

*Advanced Feature*

Discovers available endpoints based on the remote server's OpenID configuration.

 * `url`: (String) [optional]  An URL to discover the available endpoints.

##### Return Value

Returns `Promise` that resolves an `Object` containing information about the authentication
endpoint.

## Internal API

The `Auth` class is a convenience wrapper around a specific authenticator implementation. This SDK
exports an `internal` namespace which defines the actual implementation classes and the base
`Authenticator` class.

These implementation specific authentication methods can be used directly. This is useful for
testing or adding new authentication methods. These classes expose additional methods that are
considered undocumented.

 * `ClientSecret`
 * `OwnerPassword`
 * `PKCE`
 * `SignedJWT`

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-auth-sdk/LICENSE
