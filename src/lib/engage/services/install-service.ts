import chalk from 'chalk';
import * as platform from '../utils/agents/platform.js';
import * as helpers from '../utils/agents/index.js';
import logger from '../../logger.js';
import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../results/DefinitionsManager.js';
import { AccountRole, AgentConfigTypes, AgentInstallConfig, AgentNames, AgentTypes, BundleType, GatewayTypes, InstallAgentsCommandParams, Regions, SaaSGatewayTypes, YesNo, YesNoChoices } from '../types.js';
import { askList, InputValidation, validateRegex } from '../utils/basic-prompts.js';
import { loadConfig } from '../../config.js';
import { PlatformClient } from '../clients-external/platformclient.js';

import * as akamaiAgents from '../utils/agents/flows/akamaiAgent.js';
import * as akamaiSaasAgents from '../utils/agents/flows/akamaiSaasAgents.js';
import * as apigeeXAgents from '../utils/agents/flows/apigeexAgents.js';
import * as awsAgents from '../utils/agents/flows/awsAgents.js';
import * as awsSaaSAgents from '../utils/agents/flows/awsSaasAgents.js';
import * as gitHubAgents from '../utils/agents/flows/gitHubSaasAgents.js';
import * as gitLabAgents from '../utils/agents/flows/gitLabAgents.js';
import * as azureAgents from '../utils/agents/flows/azureAgents.js';
import * as edgeAgents from '../utils/agents/flows/edgeAgents.js';
import * as apigeeSaaSAgents from '../utils/agents/flows/apigeexSaasAgents.js';
import * as istioAgents from '../utils/agents/flows/istioAgents.js';
import * as azureSaasAgents from '../utils/agents/flows/azureSaasAgents.js';
import * as kafkaAgents from '../utils/agents/flows/kafkaAgents.js';
import * as swaggerHubAgents from '../utils/agents/flows/swaggerHubSaasAgents.js';
import * as graylogAgent from '../utils/agents/flows/graylogAgents.js';
import * as ibmAPIConnectAgent from '../utils/agents/flows/ibmAPIConnetAgents.js';
import * as softwareAGWebMethodsAgent from '../utils/agents/flows/softwareAGWebMethodAgents.js';
import * as traceableAgent from '../utils/agents/flows/traceableAgents.js';
import * as traceableSaaSAgents from '../utils/agents/flows/traceableSaasAgents.js';
import * as backstageAgent from '../utils/agents/flows/backstageAgents.js';
import * as sapApiPortalAgent from '../utils/agents/flows/sapApiPortalAgents.js';
import * as sensediaAgents from '../utils/agents/flows/sensediaAgents.js';
import * as wso2Agents from '../utils/agents/flows/wso2Agents.js';
import { Account } from '../../../types.js';

const log = logger('engage:install-service');

export const localhost = 'localhost';
export const svcAccMsg
	= '\nPlease make sure to copy the "private_key.pem" and "public_key.pem" files for the existing service account you selected.';

export const prompts = {
	hostedAgentOption: 'Will this be an embedded agent',
	selectGatewayType: 'Select the type of gateway you want to connect',
};

export interface InstallationFlowMethods {
	GetBundleType: (Gateway?: GatewayTypes) => Promise<BundleType>;
	GetDeploymentType: () => Promise<AgentConfigTypes>;
	AskGatewayQuestions: (
		installConfig: AgentInstallConfig,
		apiServerClient?: ApiServerClient,
		defsManager?: DefinitionsManager
	) => Promise<object>;
	InstallPreprocess?: (installConfig: AgentInstallConfig) => Promise<AgentInstallConfig>;
	AddIDP?: boolean;
	FinalizeGatewayInstall: (
		installConfig: AgentInstallConfig,
		apiServerClient?: ApiServerClient,
		defsManager?: DefinitionsManager
	) => Promise<void>;
	ConfigFiles: string[];
	AgentNameMap?: { [key in AgentTypes]?: AgentNames };
	GatewayDisplay: GatewayTypes | SaaSGatewayTypes;
}

const agentInstallFlows: { [key in GatewayTypes]: InstallationFlowMethods } = {
	[GatewayTypes.AKAMAI]: akamaiAgents.AkamaiInstallMethods,
	[GatewayTypes.EDGE_GATEWAY]: edgeAgents.EdgeInstallMethods,
	[GatewayTypes.EDGE_GATEWAY_ONLY]: edgeAgents.EdgeGWOnlyInstallMethods,
	[GatewayTypes.AWS_GATEWAY]: awsAgents.AWSInstallMethods,
	[GatewayTypes.APIGEEX_GATEWAY]: apigeeXAgents.ApigeeXInstallMethods,
	[GatewayTypes.GITLAB]: gitLabAgents.GitLabInstallMethods,
	[GatewayTypes.AZURE_GATEWAY]: azureAgents.AzureInstallMethods,
	[GatewayTypes.AZURE_EVENTHUB]: azureAgents.AzureInstallMethods,
	[GatewayTypes.ISTIO]: istioAgents.IstioInstallMethods,
	[GatewayTypes.KAFKA]: kafkaAgents.KafkaInstallMethods,
	[GatewayTypes.GRAYLOG]: graylogAgent.GraylogInstallMethods,
	[GatewayTypes.IBMAPICONNECT]: ibmAPIConnectAgent.IBMAPIConnectInstallMethods,
	[GatewayTypes.SOFTWAREAGWEBMETHODS]: softwareAGWebMethodsAgent.SoftwareAGWebMethodsInstallMethods,
	[GatewayTypes.TRACEABLE]: traceableAgent.TraceableInstallMethods,
	[GatewayTypes.BACKSTAGE]: backstageAgent.BackstageInstallMethods,
	[GatewayTypes.SAPAPIPORTAL]: sapApiPortalAgent.SAPAPIPortalInstallMethods,
	[GatewayTypes.SENSEDIA]: sensediaAgents.SensediaInstallMethods,
	[GatewayTypes.WSO2]: wso2Agents.WSO2InstallMethods,
};

const saasAgentInstallFlows: { [key: string]: InstallationFlowMethods } = {
	[GatewayTypes.AKAMAI]: akamaiSaasAgents.AkamaiSaaSInstallMethods,
	[SaaSGatewayTypes.AWS_GATEWAY as string]: awsSaaSAgents.AWSSaaSInstallMethods,
	[SaaSGatewayTypes.GITHUB]: gitHubAgents.GitHubSaaSInstallMethods,
	[SaaSGatewayTypes.APIGEEX_GATEWAY]: apigeeSaaSAgents.APIGEEXSaaSInstallMethods,
	[SaaSGatewayTypes.SWAGGERHUB]: swaggerHubAgents.SwaggerHubSaaSInstallMethods,
	[GatewayTypes.AZURE_GATEWAY]: azureSaasAgents.AzureSaaSInstallMethods,
	[GatewayTypes.AZURE_EVENTHUB]: azureSaasAgents.AzureSaaSInstallMethods,
	[GatewayTypes.TRACEABLE]: traceableSaaSAgents.TraceableSaaSInstallMethods,
};

const createConfigBackup = async (configFiles: string[], gatewayType: GatewayTypes | SaaSGatewayTypes) => {
	// If current configurations exist, back them up
	const configsExist = await helpers.createBackUpConfigs(configFiles);
	if (configsExist) {
		console.log(`\nCreated configuration backups for ${gatewayType}`);
	}
};

const determineRegion = async (region: string | undefined): Promise<string> => {
	const config = await loadConfig();
	const configurationRegion = (await config.get('region'));
	if (region) {
		return region.toString();
	}
	return configurationRegion ? configurationRegion : Regions.US;
};

async function getAgentVersions(agentInstallFlow: InstallationFlowMethods, installConfig: AgentInstallConfig, account: Account): Promise<void> {
	if (agentInstallFlow.AgentNameMap && !installConfig.switches.isHostedInstall && installConfig.switches.isDaEnabled) {
		installConfig.daVersion = await helpers.getLatestAgentVersion(
			agentInstallFlow.AgentNameMap[AgentTypes.da] as string,
			account
		);
	}
	if (agentInstallFlow.AgentNameMap && !installConfig.switches.isHostedInstall && installConfig.switches.isTaEnabled) {
		installConfig.taVersion = await helpers.getLatestAgentVersion(
			agentInstallFlow.AgentNameMap[AgentTypes.ta] as string,
			account
		);
	}
}

async function finishInstall(
	agentInstallFlow: InstallationFlowMethods,
	installConfig: AgentInstallConfig,
	apiServerClient: ApiServerClient,
	platformClient: PlatformClient,
	defsManager: DefinitionsManager
) {
	if (agentInstallFlow.InstallPreprocess) {
		installConfig = await agentInstallFlow.InstallPreprocess(installConfig);
	}

	// finalize Platform setup, only for non-hosted agents
	if (!installConfig.switches.isHostedInstall) {
		installConfig = await platform.finalizeCentralInstall(apiServerClient, platformClient, defsManager, installConfig);
	}
	return installConfig;
}

function checkUserRole(isCentralAdmin: boolean, isPlatformAdmin: boolean, accountInfo: Account) {
	if (!isCentralAdmin || !isPlatformAdmin) {
		const msg = (!accountInfo)
			? 'Error: Not authorized. Account must be assigned the roles: Platform Admin, Engage Admin'
			: 'Error: Not authorized. "Service Account" must be authorized.';
		throw new Error(msg);
	}
}

export const validateFrequency = (lowerLimit?: number): InputValidation => (input: string | number) => {
	const val = validateRegex(helpers.frequencyRegex, helpers.invalidValueExampleErrMsg('frequency', '3d5h12m'))(input);
	if (typeof val === 'string') {
		return val;
	}
	const r = input.toString().match(/^(\d*)m/);
	if (r) {
		// only minutes
		const mins = r[1];
		const minValue = parseInt(mins as string, 10);
		const minimumRequired = lowerLimit ?? 30; // Use provided lowerLimit or default to 30
		if (minValue < minimumRequired) {
			return `Minimum frequency is ${minimumRequired}m`;
		}
	}
	return true;
};

export async function installAgents(params: InstallAgentsCommandParams): Promise<void> {
	try {
		// initialize clients
		const apiServerClient = new ApiServerClient({ account: params.account, region: params.region, useCache: params.useCache, baseUrl: params.baseUrl });
		const platformClient = new PlatformClient({ baseUrl: params.baseUrl, account: params.account.name, region: params.region });
		const defsManager = await new DefinitionsManager(apiServerClient).init();
		// Verify account has permission to create an environment and service account.
		const accountInfo = await platformClient.getAccountInfo();
		const isCentralAdmin = accountInfo?.user?.roles?.includes(AccountRole.ApiCentralAdmin);
		const isPlatformAdmin = accountInfo?.user?.roles?.includes(AccountRole.PlatformAdmin);
		checkUserRole(isCentralAdmin, isPlatformAdmin, accountInfo);

		// helper text
		console.log(
			chalk.gray(
				'This command configures and installs the agents so that you can manage your gateway environment within the Amplify Platform.\n'
			)
		);

		let installConfig: AgentInstallConfig = new AgentInstallConfig();
		installConfig.centralConfig.apiServerClient = apiServerClient;
		installConfig.centralConfig.definitionManager = defsManager;
		installConfig.centralConfig.axwayManaged = !!params.axwayManaged;
		let orgRegion: string | undefined = '';
		orgRegion = params.region;

		// if region cmd arg is not passed in, then consider the region from the account info
		if (params.region === undefined) {
			orgRegion = accountInfo?.org.region;
		}

		// top priority is region option on command line, second priority is region from config file, default is US
		installConfig.centralConfig.region = await determineRegion(orgRegion);

		const gatewayTypeChoices: string[] = [];
		Object.values(GatewayTypes).forEach((v) => gatewayTypeChoices.push(v));
		Object.values(SaaSGatewayTypes)
			.filter(
				(v) =>
					v !== SaaSGatewayTypes.AWS_GATEWAY
						&& v !== SaaSGatewayTypes.APIGEEX_GATEWAY
						&& v !== SaaSGatewayTypes.TRACEABLE
						&& v !== SaaSGatewayTypes.AKAMAI
			)
			.forEach((v) => gatewayTypeChoices.push(v));

		const gatewayChoices = gatewayTypeChoices.sort().filter((v) => v !== GatewayTypes.EDGE_GATEWAY_ONLY);
		let gatewayType = (await askList({
			msg: prompts.selectGatewayType,
			choices: gatewayChoices,
		})) as GatewayTypes | SaaSGatewayTypes;

		// Check for central environments if Traceable is selected (before asking about hosted vs on-premise)
		if (gatewayType === GatewayTypes.TRACEABLE) {
			const centralEnvs = await helpers.getCentralEnvironments(
				installConfig.centralConfig.apiServerClient,
				installConfig.centralConfig.definitionManager
			);
			if (!centralEnvs || centralEnvs.length === 0) {
				throw new Error(
					'Installation cannot proceed: No Engage environments are available for mapping.\n'
					+ 'Please create at least one Engage environment before installing the Traceable agent.\n'
					+ 'You can create an environment using: axway engage create environment'
				);
			}
		}

		// if this check gets bigger, may think about an array of agents that can be both ground and embedded until ground agents become obsolete
		if (
			gatewayType === GatewayTypes.AWS_GATEWAY
				|| gatewayType === GatewayTypes.AZURE_GATEWAY
				|| gatewayType === GatewayTypes.AZURE_EVENTHUB
				|| gatewayType === GatewayTypes.APIGEEX_GATEWAY
				|| gatewayType === GatewayTypes.TRACEABLE
				|| gatewayType === GatewayTypes.AKAMAI
		) {
			// hosted vs on premise
			installConfig.switches.isHostedInstall
				= ((await askList({
					msg: prompts.hostedAgentOption,
					choices: YesNoChoices,
					default: YesNo.Yes,
				})) as YesNo) === YesNo.Yes;
		}

		if (gatewayType === SaaSGatewayTypes.GITHUB || gatewayType === SaaSGatewayTypes.SWAGGERHUB) {
			installConfig.switches.isHostedInstall = true;
		}

		// if gateway type is edge ask Gateway only or not
		if (gatewayType === GatewayTypes.EDGE_GATEWAY) {
			installConfig.switches.isGatewayOnly = false;
			gatewayType = await edgeAgents.askIsGatewayOnlyMode();
		}
		installConfig.switches.isGatewayOnly = gatewayType === GatewayTypes.EDGE_GATEWAY_ONLY;
		installConfig.gatewayType = gatewayType;

		let agentInstallFlow = agentInstallFlows[installConfig.gatewayType as GatewayTypes];
		if (installConfig.switches.isHostedInstall) {
			agentInstallFlow = saasAgentInstallFlows[installConfig.gatewayType as SaaSGatewayTypes];
		}

		// Create the object of GatewayTypes -> BundleType functions
		installConfig.bundleType = await agentInstallFlow.GetBundleType(installConfig.gatewayType as GatewayTypes);
		installConfig.switches.isDaEnabled
			= installConfig.bundleType === BundleType.ALL_AGENTS || installConfig.bundleType === BundleType.DISCOVERY;
		installConfig.switches.isTaEnabled
			= installConfig.bundleType === BundleType.ALL_AGENTS
				|| installConfig.bundleType === BundleType.TRACEABILITY
				|| installConfig.bundleType === BundleType.TRACEABILITY_OFFLINE;

		// Create the object of GatewayTypes -> BundleType functions
		installConfig.deploymentType = await agentInstallFlow.GetDeploymentType();
		installConfig.switches.isHelmInstall = installConfig.deploymentType === AgentConfigTypes.HELM;
		installConfig.switches.isDockerInstall = installConfig.deploymentType === AgentConfigTypes.DOCKERIZED;
		installConfig.switches.isBinaryInstall = installConfig.deploymentType === AgentConfigTypes.BINARIES;

		// Get the version of the agents from jfrog, not needed in hosted install
		await getAgentVersions(agentInstallFlow, installConfig, params.account);

		// if EDGE_GATEWAY or EDGE_GATEWAY_ONLY and isDaEnabled, ask if the organization structure should replicate
		if (
			(gatewayType === GatewayTypes.EDGE_GATEWAY || gatewayType === GatewayTypes.EDGE_GATEWAY_ONLY)
				&& installConfig.switches.isDaEnabled
		) {
			installConfig.switches.isOrgRep = await edgeAgents.askOrganizationReplication();
		}

		// get platform connectivity
		installConfig.centralConfig = await platform.getCentralConfig(
			apiServerClient,
			platformClient,
			defsManager,
			params.apicDeployment,
			installConfig,
			params.account
		);

		// Create the object of GatewayTypes -> GatewayConnectivity functions
		installConfig.gatewayConfig = await agentInstallFlow.AskGatewayQuestions(
			installConfig,
			apiServerClient,
			defsManager
		);

		// create the Identity Provider configuration
		if (agentInstallFlow.AddIDP) {
			installConfig.idpConfig = await helpers.idpTestables.addIdentityProvider();
		}

		// traceability options
		if (installConfig.switches.isTaEnabled && !installConfig.switches.isHostedInstall) {
			installConfig.traceabilityConfig = await platform.getTraceabilityConfig(installConfig);
		}

		// create backup
		await createConfigBackup(agentInstallFlow.ConfigFiles, agentInstallFlow.GatewayDisplay);

		// run any install preprocess steps
		installConfig = await finishInstall(
			agentInstallFlow,
			installConfig,
			apiServerClient,
			platformClient,
			defsManager
		);

		// finalize gateway setup and output
		await agentInstallFlow.FinalizeGatewayInstall(installConfig, apiServerClient, defsManager);
	} catch (err: any) {
		log.error('Installation failed', err);
		throw err;
	}
}
