/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import AmplifySDK from './amplify-sdk';
import Auth from './auth';

import Authenticator from './authenticators/authenticator';
import ClientSecret from './authenticators/client-secret';
import OwnerPassword from './authenticators/owner-password';
import PKCE from './authenticators/pkce';
import SignedJWT from './authenticators/signed-jwt';

import FileStore from './stores/file-store';
import MemoryStore from './stores/memory-store';
import SecureStore from './stores/secure-store';
import TokenStore from './stores/token-store';

import * as environments from './environments';
import getEndpoints from './endpoints';

export default AmplifySDK;

export {
	AmplifySDK,
	Auth,

	Authenticator,
	ClientSecret,
	OwnerPassword,
	PKCE,
	SignedJWT,

	FileStore,
	MemoryStore,
	SecureStore,
	TokenStore,

	environments,
	getEndpoints
};
