import AmplifySDK from './amplify-sdk.js';
import Auth from './auth.js';

import Authenticator from './authenticators/authenticator.js';
import ClientSecret from './authenticators/client-secret.js';
import OwnerPassword from './authenticators/owner-password.js';
import PKCE from './authenticators/pkce.js';
import SignedJWT from './authenticators/signed-jwt.js';

import FileStore from './stores/file-store.js';
import MemoryStore from './stores/memory-store.js';
import SecureStore from './stores/secure-store.js';
import TokenStore from './stores/token-store.js';

import * as environments from './environments.js';
import getEndpoints from './endpoints.js';

import Telemetry, {
	CrashPayload,
	EventPayload,
	TelemetryOptions
} from './telemetry.js';

import {
	Account,
	AccountAuthInfo,
	ActivityEvent,
	ActivityParams,
	ActivityResult,
	AmplifySDKOptions,
	Client,
	ClientRef,
	ClientTeam,
	DefaultTeams,
	Entitlement,
	Entitlements,
	Environment,
	Org,
	OrgLike,
	OrgPartner,
	OrgRef,
	OrgUser,
	Role,
	Subscription,
	Team,
	TeamInfo,
	TeamInfoChanges,
	TeamUser,
	User,
	UserChanges,
	UserInfo,
	UsageParams,
	UsageParamsRange,
	UsageParamsMonth,
	UsageResult
} from './types.js';

export default AmplifySDK;

export {
	AmplifySDK,
	Auth,
	Telemetry,

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

export type {
	Account,
	AccountAuthInfo,
	ActivityEvent,
	ActivityParams,
	ActivityResult,
	AmplifySDKOptions,
	Client,
	ClientRef,
	ClientTeam,
	CrashPayload,
	DefaultTeams,
	Entitlement,
	Entitlements,
	Environment,
	EventPayload,
	Org,
	OrgLike,
	OrgPartner,
	OrgRef,
	OrgUser,
	Role,
	Subscription,
	Team,
	TeamInfo,
	TeamInfoChanges,
	TeamUser,
	TelemetryOptions,
	User,
	UserChanges,
	UserInfo,
	UsageParams,
	UsageParamsRange,
	UsageParamsMonth,
	UsageResult
};
