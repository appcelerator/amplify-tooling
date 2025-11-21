type Account = {
	/** Optional name of a configuration profile the account is associated with */
	profile?: string;
	/** Unique hash for the account */
	hash: string;
	/** Friendly name for the account */
	name: string;

	/** Authentication information for the account */
	auth: {
		/** Name of the authenticator used to obtain the tokens */
		authenticator: string;
		/** Base URL for the AxwayID server used to authenticate the account */
		baseUrl: string;
		/** Client ID for the service account registered with AxwayID */
		clientId: string;
		/** Client secret for the service account. Only applicable for the `client-secret` authenticator */
		clientSecret?: string;
		/** Secret used to sign JWTs. Only applicable for the `signed-jwt` authenticator */
		secret?: string;
		/** Name of the environment */
		env?: string;
		/** Expiration times for the tokens */
		expires: {
			/** Access token expiration time */
			access: number;
			/** Refresh token expiration time */
			refresh?: number;
		};
		/** Realm to use in the configured AxwayID server to authenticate the account */
		realm?: string;
		/** Tokens for the account */
		tokens: {
			/** Access token. This is the token used to authenticate requests */
			access_token?: string;
			/** Refresh token. This is used to obtain new access tokens */
			refresh_token?: string;
			/** ID token. This is a JWT that contains identity information about the authenticated account */
			id_token?: string;
			/** Token expiration time in seconds */
			expires_in?: number;
		};
		/**
		 * Username for the account.
		 * @deprecated Service accounts do not use usernames for authentication.
		 */
		username?: string;
		/**
		 * Password for the account.
		 * @deprecated Service accounts do not use passwords for authentication.
		 */
		password?: string;
	};

	/**
	 * User the account is associated with.
	 * Note that this will only ever be for a service account, but it is called "user"
	 * for backwards compatibility when platform user authentication was supported.
	 */
	user?: {
		guid?: string;
		email?: string;
		roles?: string[];
		[key: string]: any;
	};

	/** Organization the account is associated with */
	org?: Organization & {
		/** Teams the account has access to in the organization */
		teams?: Array<{
			guid: string;
			name?: string;
			users?: Array<{
				guid: string;
				roles?: string[];
				type?: string;
			}>;
		}>;
	};

	/**
	 * Array of organizations the account has access to.
	 * @deprecated Service accounts are only associated with a single organization.
	 */
	orgs?: Array<{
		guid: string;
		id?: number;
		name: string;
		default?: boolean;
		[key: string]: any;
	}>;

	/** Current team the account is using */
	team?: {
		/** Unique identifier for the team */
		guid?: string;
		/** Name of the team */
		name?: string;
		/** Whether this is the default team for the organization */
		default?: boolean;
		/** Roles the account has in the team */
		roles?: string[];
		/** Tags associated with the team */
		tags?: string[];
	};

	/** Indicates if this is the default account */
	default?: boolean;
}

/** Platform Organization */
type Organization = {
	/** Unique identifier for the organization */
	guid?: string;
	/** Numeric ID for the organization */
	org_id?: number;
	/** Numeric ID for the organization */
	id?: number;
	/** Name for the organization */
	name?: string;
	/** Region the organization is associated with */
	region?: string;
	/** Subscriptions the organization has */
	subscriptions?: Array<any>;
	/** Entitlements the organization has from its active subscriptions */
	entitlements?: {
		[key: string]: any;
	};

	[key: string]: any;
}
