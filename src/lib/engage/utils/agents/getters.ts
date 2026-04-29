import { ApiServerClient } from '../../clients-external/apiserverclient.js';
import { ApiServerClientListResult, BasePaths, PublicRepoUrl } from '../../types.js';
import { dataService } from '../../../request.js';
import { DefinitionsManager } from '../../results/DefinitionsManager.js';
import logger from '../../../logger.js';
import { Account } from '../../../../types.js';

const { log } = logger('lib: engage: utils: agents: getters');

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

export const getLatestAgentVersion = async (agent: string, account: Account): Promise<string> => {
	try {
		const service = await dataService({ account, baseUrl: PublicRepoUrl + BasePaths.DockerAgentAPIRepoPath });

		const response = await service.get(
			`/${agent}/tags/list`,
			{
				// docker api requires auth, even if its just anonymous
				Authorization: `Basic ${Buffer.from('anonymous:').toString('base64')}`,
			},
			true
		);

		if (response.tags.length === 0) {
			return 'latest';
		}
		const latestVersion = response.tags.reduce((prev: string, current: string) => {
			// skip any tags that are latest
			if (prev === 'latest') {
				return current;
			} else if (current === 'latest') {
				return prev;
			}

			// find the largest tag
			const [ pMajor, pMinor, pPatch ] = prev.split('.').map(Number);
			const [ cMajor, cMinor, cPatch ] = current.split('.').map(Number);

			if (cMajor > pMajor) {
				return current;
			}
			if (cMajor === pMajor && cMinor > pMinor) {
				return current;
			}
			if (cMajor === pMajor && cMinor === pMinor && cPatch > pPatch) {
				return current;
			}
			return prev;
		});
		log(`Latest Version (${agent}): ${latestVersion}`);
		return latestVersion;
	} catch (e: any) {
		log('Error hit retrieving latest version of agent, setting tag to latest');
		log(e);
		return 'latest';
	}
};
