import { CentralAgentConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the Backstage handlebars templates.
 */
export class BackstageAgentValues {
	host: string;
	scheme: UrlScheme;
	backendPort: number;
	urlPath: string;
	authMode: AuthMode;
	staticTokenValue: string;
	jwksClientID: string;
	jwksClientSecret: string;
	jwksTokenURL: string;
	centralConfig: CentralAgentConfig;

	constructor() {
		this.host = '';
		this.scheme = UrlScheme.HTTP;
		this.backendPort = 0;
		this.urlPath = '';
		this.authMode = AuthMode.NoAuth;
		this.staticTokenValue = '';
		this.jwksClientID = '';
		this.jwksClientSecret = '';
		this.jwksTokenURL = '';
		this.centralConfig = new CentralAgentConfig();
	}
}

export enum UrlScheme {
	HTTP = 'http',
	HTTPS = 'https',
}

export enum AuthMode {
	NoAuth = '',
	Guest = 'guest',
	StaticToken = 'token',
	Jwks = 'jwks',
}

/**
 * @description Generates the Backstage DA env vars file.
 */
export const backstageDAEnvVarTemplate = () => {
	return `# Backstage configs
BACKSTAGE_URL_SCHEME={{scheme}}
BACKSTAGE_URL_HOST={{host}}
{{#compare . backendPort 0 operator=">="}}
BACKSTAGE_URL_BACKENDPORT={{backendPort}}
{{/compare}}
{{#compare . urlPart ""}}
BACKSTAGE_URL_PATH={{urlPath}}
{{/compare}}
{{#compare . authMode "" operator="!="}}
BACKSTAGE_AUTH_MODE={{authMode}}
{{/compare}}
{{#compare . authMode "token"}}
BACKSTAGE_AUTH_STATICTOKEN={{staticTokenValue}}
{{/compare}}
{{#compare . authMode "jwks"}}
BACKSTAGE_AUTH_CLIENTID={{jwksClientID}}
BACKSTAGE_AUTH_CLIENTSECRET={{jwksClientSecret}}
BACKSTAGE_AUTH_TOKENURL={{jwksTokenURL}}
{{/compare}}

# Amplify Central configs
CENTRAL_AGENTNAME={{centralConfig.daAgentName}}
CENTRAL_AUTH_CLIENTID={{centralConfig.dosaAccount.clientId}}
CENTRAL_AUTH_PRIVATEKEY={{centralConfig.dosaAccount.templatePrivateKey}}
CENTRAL_AUTH_PUBLICKEY={{centralConfig.dosaAccount.templatePublicKey}}
CENTRAL_ENVIRONMENT={{centralConfig.environment}}
CENTRAL_ORGANIZATIONID={{centralConfig.orgId}}
CENTRAL_TEAM={{centralConfig.ampcTeamName}}
CENTRAL_REGION={{centralConfig.region}}

# Logging configs
# Define the logging level: info, debug, error
LOG_LEVEL=info
# Specify where to send the log: stdout, file, both
LOG_OUTPUT=stdout
# Define where the log files are written
LOG_FILE_PATH=logs
`;
};
