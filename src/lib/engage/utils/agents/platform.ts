import chalk from 'chalk';
import { ApiServerClient } from '../../clients-external/apiserverclient.js';
import { askList } from '../../utils/basic-prompts.js';
import { DefinitionsManager } from '../../results/DefinitionsManager.js';
import { PlatformClient } from '../../clients-external/platformclient.js';
import {
	AgentInstallConfig,
	AgentResourceKind,
	AgentTypes,
	APICDeployments,
	BundleType,
	CentralAgentConfig,
	DOSAConfigInfo,
	GatewayTypes,
	GatewayTypeToDataPlane,
	Platforms,
	PlatformTeam,
	Regions,
	TraceabilityConfig,
	YesNo,
	YesNoChoices,
} from '../../types.js';
// import { DeploymentTypes } from './awsAgents';
import * as helpers from '../../utils/agents/index.js';
import { DeploymentTypes } from './flows/awsAgents.js';
import { Account } from '../../../../types.js';
import loadConfig from '../../../config.js';
// import { AWSAgentValues } from './helpers';

//
// Complex prompts
//
const askTeamName = async (client: PlatformClient): Promise<string> => {
	const teams: PlatformTeam[] = await client.getTeams();
	if (!teams?.length) {
		throw new Error('Account has no teams!');
	}
	return askList({
		msg: helpers.envMessages.selectTeam,
		choices: teams.map((t) => t.name).sort((name1, name2) => name1.localeCompare(name2)),
		default: teams.find((t) => t.default)?.name,
	});
};

const askIsProductionEnvironment = async (): Promise<boolean> => {
	return (
		(await askList({
			msg: helpers.envMessages.isProduction,
			choices: YesNoChoices,
			default: YesNo.Yes,
		})) === YesNo.Yes
	);
};

export const getTraceabilityConfig = async (installConfig: AgentInstallConfig): Promise<TraceabilityConfig> => {
	const traceabilityConfig = new TraceabilityConfig();

	if (
		installConfig.gatewayType === GatewayTypes.AWS_GATEWAY
		&& (installConfig.gatewayConfig as helpers.AWSAgentValues).cloudFormationConfig.DeploymentType === DeploymentTypes.ECS_FARGATE
	) {
		return traceabilityConfig;
	}

	traceabilityConfig.usageReportingOffline = installConfig.bundleType === BundleType.TRACEABILITY_OFFLINE;

	return traceabilityConfig;
};

export const getCentralConfig = async (
	apiServerClient: ApiServerClient,
	platformClient: PlatformClient,
	defsManager: DefinitionsManager,
	apicDeployment: string | undefined,
	installConfig: AgentInstallConfig,
	account: Account
): Promise<CentralAgentConfig> => {
	// initiate CentralAgentConfig
	const centralConfig = installConfig.centralConfig;

	centralConfig.deployment
		= apicDeployment || await getApicDeployment(centralConfig.region as Regions, account.auth?.env as Platforms);

	// apic config
	console.log('\nCONNECTION TO AMPLIFY PLATFORM:');
	console.log(chalk.gray('The agents need access to the Amplify Platform to register services.'));

	// create/find environment
	if (!account.org?.id) {
		throw Error('Can\'t find org ID');
	}
	centralConfig.orgId = account.org?.id.toString();
	centralConfig.ampcEnvInfo = await helpers.askEnvironmentName(
		apiServerClient,
		defsManager,
		centralConfig.axwayManaged,
		installConfig.gatewayType
	);
	centralConfig.production = centralConfig.ampcEnvInfo.isNew ? await askIsProductionEnvironment() : false;

	if (installConfig.gatewayType === GatewayTypes.GRAYLOG) {
		const updatedRefEnvs = await helpers.askReferencedEnvironments(
			apiServerClient,
			defsManager,
			centralConfig.ampcEnvInfo
		);
		const compareRefs = (a: string[], b: string[]) => {
			return a?.length === b?.length && a?.every((element) => b?.includes(element));
		};
		if (!compareRefs(updatedRefEnvs, centralConfig.ampcEnvInfo.referencedEnvironments)) {
			centralConfig.ampcEnvInfo.referencedEnvironments = updatedRefEnvs;
			centralConfig.ampcEnvInfo.isUpdated = true;
		}
	}

	if (!installConfig.switches.isOrgRep) {
		centralConfig.ampcTeamName = await askTeamName(platformClient);
	}

	centralConfig.ampcDosaInfo = { clientId: '', name: '', isNew: false } as DOSAConfigInfo;
	if (installConfig.bundleType !== BundleType.TRACEABILITY_OFFLINE && !installConfig.switches.isHostedInstall) {
		centralConfig.ampcDosaInfo = await helpers.askDosaClientId(platformClient);
	}

	// Get the DA Agent name
	centralConfig.daAgentName = '';
	// Istio will not prompt for agent name.  Remove when that ability exists
	if (installConfig.switches.isDaEnabled && !installConfig.switches.isHostedInstall) {
		centralConfig.daAgentName = await helpers.askAgentName(
			apiServerClient,
			defsManager,
			AgentTypes.da,
			centralConfig.ampcEnvInfo.name
		);
	}

	// Initialize agent names
	centralConfig.taAgentName = '';
	centralConfig.caAgentName = '';

	// Determine if we should use CA (compliance) or TA agent. Compliance is good for TRACEABLE, AKAMAI and GRAYLOG (atm)
	const isCaType
		= installConfig.gatewayType === GatewayTypes.TRACEABLE
		|| installConfig.gatewayType === GatewayTypes.AKAMAI
		|| installConfig.gatewayType === GatewayTypes.GRAYLOG;
	const agentType = isCaType ? AgentTypes.ca : AgentTypes.ta;
	const agentNameProperty = isCaType ? 'caAgentName' : 'taAgentName';

	if (installConfig.switches.isTaEnabled && !installConfig.switches.isHostedInstall) {
		const agentName = await helpers.askAgentName(
			apiServerClient,
			defsManager,
			agentType,
			centralConfig.ampcEnvInfo.name
		);
		centralConfig[agentNameProperty] = agentName;
	}

	return centralConfig;
};

export const finalizeCentralInstall = async (
	apiServerClient: ApiServerClient,
	platformClient: PlatformClient,
	defsManager: DefinitionsManager,
	installConfig: AgentInstallConfig
): Promise<AgentInstallConfig> => {
	/**
	 * Create agent resources
	 */
	console.log('Creating agent resources');

	if (installConfig.centralConfig.ampcDosaInfo.isNew) {
		installConfig.centralConfig.dosaAccount = await helpers.createDosaAndCerts(
			platformClient,
			installConfig.centralConfig.ampcDosaInfo.name
		);
	} else {
		installConfig.centralConfig.dosaAccount.clientId = installConfig.centralConfig.ampcDosaInfo.clientId as string;
	}
	installConfig.centralConfig.dosaAccount.updateKeyTemplateValues(installConfig.deploymentType);

	let refEnvSubResource;
	if (installConfig.centralConfig.ampcEnvInfo.referencedEnvironments) {
		refEnvSubResource = {
			references: { managedEnvironments: installConfig.centralConfig.ampcEnvInfo.referencedEnvironments },
		};
	}

	// environment name
	installConfig.centralConfig.environment = installConfig.centralConfig.ampcEnvInfo.isNew
		? await helpers.createByResourceType(
			apiServerClient,
			defsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment',
			'env',
			{
				axwayManaged: installConfig.centralConfig.axwayManaged,
				production: installConfig.centralConfig.production,
			},
			'',
			refEnvSubResource
		)
		: installConfig.centralConfig.ampcEnvInfo.name;

	if (installConfig.centralConfig.ampcEnvInfo.isUpdated) {
		await helpers.updateSubResourceType(
			apiServerClient,
			defsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment',
			'env',
			'',
			refEnvSubResource
		);
	}

	// Create DiscoveryAgent Resource unless gateway type is Istio.  This can be removed when this is available for Istio
	if (installConfig.centralConfig.daAgentName !== '') {
		installConfig.centralConfig.daAgentName = await helpers.createNewAgentResource(
			apiServerClient,
			defsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType],
			AgentResourceKind.da,
			AgentTypes.da,
			installConfig.centralConfig.ampcTeamName,
			installConfig.centralConfig.daAgentName
		);
	}

	// Create TraceabilityAgent Resource
	if (installConfig.centralConfig.taAgentName !== '') {
		installConfig.centralConfig.taAgentName = await helpers.createNewAgentResource(
			apiServerClient,
			defsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType],
			AgentResourceKind.ta,
			AgentTypes.ta,
			installConfig.centralConfig.ampcTeamName,
			installConfig.centralConfig.taAgentName
		);
	}

	// Create ComplianceAgent Resource
	if (installConfig.centralConfig.caAgentName !== '') {
		installConfig.centralConfig.caAgentName = await helpers.createNewAgentResource(
			apiServerClient,
			defsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[installConfig.gatewayType],
			AgentResourceKind.ca,
			AgentTypes.ca,
			installConfig.centralConfig.ampcTeamName,
			installConfig.centralConfig.caAgentName,
			undefined,
			undefined,
			undefined,
			{ managedEnvironment: (installConfig.gatewayConfig as helpers.ComplianceAgentValues).centralEnvironments } // cast applied here
		);
	}

	if (
		installConfig.bundleType === BundleType.TRACEABILITY_OFFLINE
		|| installConfig.gatewayType === GatewayTypes.ISTIO
	) {
		installConfig.centralConfig.environmentId = await helpers.getEnvironmentId(
			apiServerClient,
			defsManager,
			installConfig.centralConfig.environment
		);
	}

	return installConfig;
};

export const getApicDeployment = async (region: Regions, env: Platforms) => {
	const deployments = {
		[Regions.US]: {
			[Platforms.prod]: APICDeployments.US,
			[Platforms.staging]: APICDeployments.TEAMS,
			[Platforms.preprod]: APICDeployments.USPreprod,
		},
		[Regions.EU]: {
			[Platforms.prod]: APICDeployments.EU,
			[Platforms.staging]: APICDeployments.EUStaging,
			[Platforms.preprod]: APICDeployments.EUPreprod,
		},
		[Regions.AP]: {
			[Platforms.prod]: APICDeployments.AP,
			[Platforms.staging]: APICDeployments.APStaging,
			[Platforms.preprod]: APICDeployments.APPreprod,
		},
	};
	const config = await loadConfig();
	const savedDeployment = (await config.get('engage.apic-deployment'));
	return savedDeployment || deployments?.[region]?.[env] || APICDeployments.US;
};
