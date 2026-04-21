import chalk from 'chalk';
import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../results/DefinitionsManager.js';
import { AgentResourceCreateResult, AgentResourceKind, AgentTypes, ApiServerClientSingleResult, BundleType, CreateCommandParams, CreateCommandResult, CreateEnvironmentCommandParams, DataPlaneNames, EngageCommandParams, GenericResource } from '../types.js';
import { getLatestServedAPIVersion, loadAndVerifySpecs, verifyFile } from '../utils/utils.js';
import { askInput, askList } from '../utils/basic-prompts.js';
import { askAgentName, askEnvironmentName } from '../utils/agents/inputs.js';
import { createByResourceType, createNewAgentResource } from '../utils/agents/creators.js';

export async function createResources(params: CreateCommandParams): Promise<CreateCommandResult> {
	const { account, region, useCache, filePath, onMissingNames } = params;

	verifyFile(filePath);

	const client = new ApiServerClient({ account, region, useCache });
	const defsManager = await new DefinitionsManager(client).init();

	const { docs, isMissingName } = await loadAndVerifySpecs(filePath, defsManager.getAllKindsList());

	if (isMissingName && onMissingNames) {
		const shouldContinue = await onMissingNames();
		if (!shouldContinue) {
			return { results: { success: [], error: [] }, hasErrors: false };
		}
	}

	const sortedKindsMap = defsManager.getSortedKindsMap();
	const result = await client.bulkCreate(docs as GenericResource[], sortedKindsMap);
	const hasErrors = result.error.length > 0;

	return { results: result, hasErrors };
}

export async function createEnvironment(params: CreateEnvironmentCommandParams): Promise<ApiServerClientSingleResult> {
	const { account, region, useCache, name } = params;

	const client = new ApiServerClient({ account, region, useCache });
	const defsManager = await new DefinitionsManager(client).init();
	const sortedKindsMap = defsManager.getSortedKindsMap();
	const resourceDef = Array.from(sortedKindsMap.values()).find(def => def.spec.kind === 'Environment');
	let version = 'v1alpha1';
	if (resourceDef) {
		version = getLatestServedAPIVersion(resourceDef);
	}
	const resource: GenericResource = {
		apiVersion: version,
		kind: 'Environment',
		group: 'management',
		title: name,
		name: name,
		attributes: {},
		tags: [],
		spec: {}
	};
	const response = await client.createResource({ resourceDef: resourceDef, resource: resource });
	return response;
}

export async function createAgentResource(params: EngageCommandParams): Promise<void> {
	const { account, region, useCache } = params;

	const result: AgentResourceCreateResult = {
		agentType: '',
		dataPlaneName: '',
		environmentName: '',
		teamName: '',
		discoveryAgentName: '',
		ampcDiscoveryAgentName: '',
		traceabilityAgentName: '',
		ampcTraceabilityAgentName: '',
	};

	const apiServerClient = new ApiServerClient({ account, region, useCache });
	const defsManager = await new DefinitionsManager(apiServerClient).init();

	// Agent resource Type
	result.agentType = await askAgentType();
	const isDiscoveryAgent
		= result.agentType === BundleType.DISCOVERY || result.agentType === BundleType.ALL_AGENTS;
	const isTraceabilityAgent
		= result.agentType === BundleType.TRACEABILITY || result.agentType === BundleType.ALL_AGENTS;

	// environment
	const environmentInfo = await askEnvironmentName(apiServerClient, defsManager);
	if (isDiscoveryAgent) {
		// Discovery Agent Name
		result.discoveryAgentName = await askAgentName(
			apiServerClient,
			defsManager,
			AgentTypes.da,
			environmentInfo.name
		);
	}

	if (isTraceabilityAgent) {
		// Traceability Agent Name
		result.traceabilityAgentName = await askAgentName(
			apiServerClient,
			defsManager,
			AgentTypes.ta,
			environmentInfo.name
		);
	}

	// dataplane name
	result.dataPlaneName = await askDataPlaneName();
	if (result.dataPlaneName === DataPlaneNames.OTHER) {
		result.dataPlaneName = (await askInput({
			msg: 'Enter the type of dataplane type',
		})) as string;
	}

	// Create Environment Name if necessary
	result.environmentName = environmentInfo.isNew
		? await createByResourceType(apiServerClient, defsManager, environmentInfo.name, 'Environment', 'env')
		: environmentInfo.name;

	if (isDiscoveryAgent) {
		// Create DiscoveryAgent Resource
		result.ampcDiscoveryAgentName = await createNewAgentResource(
			apiServerClient,
			defsManager,
			result.environmentName,
			result.dataPlaneName,
			AgentResourceKind.da,
			AgentTypes.da,
			result.teamName,
			result.discoveryAgentName
		);
		console.log(
			chalk.cyan(
				`To use this resource, add the following to your discovery agent's environment variables file: CENTRAL_AGENTNAME=${result.discoveryAgentName}\n`
			)
		);
	}

	if (isTraceabilityAgent) {
		// Create TraceabilityAgent Resource
		result.ampcTraceabilityAgentName = await createNewAgentResource(
			apiServerClient,
			defsManager,
			result.environmentName,
			result.dataPlaneName,
			AgentResourceKind.ta,
			AgentTypes.ta,
			result.teamName,
			result.traceabilityAgentName
		);
		console.log(
			chalk.cyan(
				`To use this resource, add the following to your traceability agent's environment variables file: CENTRAL_AGENTNAME=${result.traceabilityAgentName}`
			)
		);
	}
}

const askAgentType = async (): Promise<string> =>
	(await askList({
		msg: 'Select the type of agent resource(s) you want to create',
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;

const askDataPlaneName = async (): Promise<string> =>
	(await askList({
		msg: 'Select the type of dataplane you want to create',
		choices: [ DataPlaneNames.AWS, DataPlaneNames.AZURE, DataPlaneNames.EDGE, DataPlaneNames.OTHER ],
	})) as BundleType;
