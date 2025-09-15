import AmplifySDK from './amplify-sdk.js';
import Auth from './auth.js';
import Telemetry from './telemetry.js';

import Authenticator from './authenticators/authenticator.js';
import ClientSecret from './authenticators/client-secret.js';
import SignedJWT from './authenticators/signed-jwt.js';

import FileStore from './stores/file-store.js';
import MemoryStore from './stores/memory-store.js';
import SecureStore from './stores/secure-store.js';
import TokenStore from './stores/token-store.js';

export default AmplifySDK;

export {
	AmplifySDK,
	Auth,
	Telemetry,

	Authenticator,
	ClientSecret,
	SignedJWT,

	FileStore,
	MemoryStore,
	SecureStore,
	TokenStore
};
