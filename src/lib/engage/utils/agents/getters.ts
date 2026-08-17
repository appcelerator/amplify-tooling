import { ApiServerClient } from '../../clients-external/apiserverclient.js';
import { ApiServerClientListResult } from '../../types.js';
import { DefinitionsManager } from '../../results/DefinitionsManager.js';
import logger from '../../../logger.js';

const { log, error } = logger('lib: engage: utils: agents: getters');

export interface GetResourceListInput {
	client: ApiServerClient;
	defsManager: DefinitionsManager;
	resourceType: string;
	resourceShortName: string;
	scopeName?: string;
	query?: string;
}

export const getListByResource = async (input: GetResourceListInput): Promise<ApiServerClientListResult> => {
	// NOTE: only a first found set is used
	const defs = input.defsManager.findDefsByWord(input.resourceShortName);
	if (!defs) {
		throw Error(`the server doesn't have a resource type "${input.resourceType}"`);
	}
	return input.client.getResourcesList({
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: input.scopeName,
		query: input.query,
	});
};

// Note: forcing it to use apicentral client id
// export const getCurrentUserOrgId = async (): Promise<string> => {
// 	const authData = await new CoreConfigController().getAuthInfo();
// 	if (!authData.orgId) throw Error(`Can't find org ID`);
// 	return authData.orgId;
// };

export const getEnvironmentId = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	environmentName: string,
	scopeName?: string
): Promise<string> => {
	const defs = defsManager.findDefsByWord('env');
	if (!defs) {
		throw Error('the server doesn\'t have a resource type "Environment"');
	}
	const resource = await client.getResourceByName({
		resourceDef: defs[0].resource,
		resourceName: environmentName,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: scopeName ? scopeName : undefined,
	});
	return resource.data?.metadata ? resource.data.metadata.id || '' : '';
};

export const getLatestAgentVersion = async (client: ApiServerClient, agentName: string): Promise<string> => {
	try {
		const componentDef = await client.getComponentDefinitionsByName(agentName);
		const version = componentDef.spec?.latest?.version;
		if (version) {
			log(`Latest Version (${agentName}): ${version}`);
			return version;
		}
		return 'latest';
	} catch (e: any) {
		error('Error retrieving latest version, setting tag to latest');
		error(e);
		return 'latest';
	}
};
