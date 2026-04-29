import { CentralAgentConfig, TraceabilityConfig } from '../../../types.js';

/**
 * @description Parameters to provide to the Kafka handlebars templates.
 */
export class KafkaAgentValues {
	cloudEnabled: boolean;
	cloudEnvironmentId: string;
	cloudAPIKey: string;
	cloudAPISecret: string;
	cloudClusterId: string;
	clusterServer: string;
	clusterAPIKey: string;
	clusterAPISecret: string;
	clusterSaslMechanism: string;
	clusterSaslUser: string;
	clusterSaslPassword: string;
	saslOauthTokenUrl: string;
	saslOauthClientId: string;
	saslOauthClientSecret: string;
	saslOauthClientScopes: string;
	schemaRegistryEnabled: boolean;
	schemaRegistryUrl: string;
	schemaRegistryAuthEnabled: boolean;
	schemaRegistryAPIKey: string;
	schemaRegistryAPISecret: string;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.cloudEnabled = false;
		this.cloudEnvironmentId = '';
		this.cloudAPIKey = '';
		this.cloudAPISecret = '';
		this.cloudClusterId = '';
		this.clusterServer = '';
		this.clusterAPIKey = '';
		this.clusterAPISecret = '';
		this.clusterSaslMechanism = '';
		this.clusterSaslUser = '';
		this.clusterSaslPassword = '';
		this.saslOauthTokenUrl = '';
		this.saslOauthClientId = '';
		this.saslOauthClientSecret = '';
		this.saslOauthClientScopes = '';
		this.schemaRegistryEnabled = false;
		this.schemaRegistryUrl = '';
		this.schemaRegistryAuthEnabled = true;
		this.schemaRegistryAPIKey = '';
		this.schemaRegistryAPISecret = '';
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the Kafka DA env vars file.
 */
export const kafkaDAEnvVarTemplate = () => {
	return `# Kafka cluster configs
{{#if cloudEnabled}}
KAFKA_CLOUD_ENABLED={{cloudEnabled}}
KAFKA_CLOUD_ENVIRONMENT={{cloudEnvironmentId}}
KAFKA_CLOUD_AUTH_APIKEY_ID={{cloudAPIKey}}
KAFKA_CLOUD_AUTH_APIKEY_SECRET={{cloudAPISecret}}
KAFKA_CLUSTER_ID={{cloudClusterId}}
KAFKA_CLUSTER_AUTH_APIKEY_ID={{clusterAPIKey}}
KAFKA_CLUSTER_AUTH_APIKEY_SECRET={{clusterAPISecret}}
{{else}}
KAFKA_CLUSTER_SERVERS={{clusterServer}}
{{#compare . clusterSaslMechanism "NONE" operator="!="}}
KAFKA_CLUSTER_AUTH_SASL_MECHANISM={{clusterSaslMechanism}}
{{#compare . clusterSaslMechanism "OAUTHBEARER" operator="=="}}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_TOKENURL={{saslOauthTokenUrl}}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_CLIENTID={{saslOauthClientId}}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_CLIENTSECRET={{saslOauthClientSecret}}
{{#compare . saslOauthClientScopes "" operator="!=" }}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_SCOPES={{saslOauthClientScopes}}
{{/compare}}
{{/compare}}
{{#compare . clusterSaslMechanism "OAUTHBEARER" operator="!="}}
KAFKA_CLUSTER_AUTH_SASL_USERNAME={{clusterSaslUser}}
KAFKA_CLUSTER_AUTH_SASL_PASSWORD={{clusterSaslPassword}}
{{/compare}}
{{/compare}}
{{/if}}

{{#if cloudEnabled}}
KAFKA_SCHEMAREGISTRY_ENABLED=true
KAFKA_SCHEMAREGISTRY_AUTH_APIKEY_ID={{schemaRegistryAPIKey}}
KAFKA_SCHEMAREGISTRY_AUTH_APIKEY_SECRET={{schemaRegistryAPISecret}}
{{else}}
{{#if schemaRegistryEnabled}}
KAFKA_SCHEMAREGISTRY_ENABLED=true
KAFKA_SCHEMAREGISTRY_URL={{schemaRegistryUrl}}
{{#if schemaRegistryAuthEnabled}}
KAFKA_SCHEMAREGISTRY_AUTH_SASL_MECHANISM={{clusterSaslMechanism}}
{{#compare . clusterSaslMechanism "OAUTHBEARER" operator="=="}}
KAFKA_SCHEMAREGISTRY_AUTH_SASL_OAUTH_TOKENURL={{saslOauthTokenUrl}}
KAFKA_SCHEMAREGISTRY_AUTH_SASL_OAUTH_CLIENTID={{saslOauthClientId}}
KAFKA_SCHEMAREGISTRY_AUTH_SASL_OAUTH_CLIENTSECRET={{saslOauthClientSecret}}
{{#compare . saslOauthClientScopes "" operator="!=" }}
KAFKA_SCHEMAREGISTRY_AUTH_SASL_OAUTH_SCOPES={{saslOauthClientScopes}}
{{/compare}}
{{/compare}}
{{#compare . clusterSaslMechanism "OAUTHBEARER" operator="!="}}
KAFKA_SCHEMAREGISTRY_AUTH_SASL_USERNAME={{clusterSaslUser}}
KAFKA_SCHEMAREGISTRY_AUTH_SASL_PASSWORD={{clusterSaslPassword}}
{{/compare}}
{{/if}}
{{/if}}
{{/if}}

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

/**
 * @description Generates the Kafka TA env vars file.
 */
export const kafkaTAEnvVarTemplate = () => {
	return `# Kafka cluster configs
{{#if cloudEnabled}}
KAFKA_CLOUD_ENABLED={{cloudEnabled}}
KAFKA_CLOUD_ENVIRONMENT={{cloudEnvironmentId}}
KAFKA_CLOUD_AUTH_APIKEY_ID={{cloudAPIKey}}
KAFKA_CLOUD_AUTH_APIKEY_SECRET={{cloudAPISecret}}
KAFKA_CLUSTER_ID={{cloudClusterId}}
KAFKA_CLUSTER_AUTH_APIKEY_ID={{clusterAPIKey}}
KAFKA_CLUSTER_AUTH_APIKEY_SECRET={{clusterAPISecret}}
{{else}}
KAFKA_CLUSTER_SERVERS={{clusterServer}}
{{#compare . clusterSaslMechanism "NONE" operator="!="}}
KAFKA_CLUSTER_AUTH_SASL_MECHANISM={{clusterSaslMechanism}}
{{#compare . clusterSaslMechanism "OAUTHBEARER" operator="=="}}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_TOKENURL={{saslOauthTokenUrl}}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_CLIENTID={{saslOauthClientId}}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_CLIENTSECRET={{saslOauthClientSecret}}
{{#compare . saslOauthClientScopes "" operator="!=" }}
KAFKA_CLUSTER_AUTH_SASL_OAUTH_SCOPES={{saslOauthClientScopes}}
{{/compare}}
{{/compare}}
{{#compare . clusterSaslMechanism "OAUTHBEARER" operator="!="}}
KAFKA_CLUSTER_AUTH_SASL_USERNAME={{clusterSaslUser}}
KAFKA_CLUSTER_AUTH_SASL_PASSWORD={{clusterSaslPassword}}
{{/compare}}
{{/compare}}
{{/if}}

# Amplify Central configs
CENTRAL_AGENTNAME={{centralConfig.taAgentName}}
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
