import logger from '../../logger.js';
import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../results/DefinitionsManager.js';
import { loadAndVerifySpecs, parseScopeParam, verifyFile, verifyScopeParam } from '../utils/utils.js';
import {
	ApiServerClientSingleResult,
	DeleteCommandParams,
	DeleteCommandResult,
	GenericResource,
} from '../types.js';

const log = logger('engage:delete-service');

export async function deleteResources(params: DeleteCommandParams): Promise<DeleteCommandResult> {
	const {
		account,
		region,
		useCache,
		resourceType,
		resourceName,
		filePath,
		scopeParam,
		wait,
		forceDelete,
		skipConfirmation,
		onConfirmSingleDelete,
		onConfirmForceDelete,
	} = params;

	const client = new ApiServerClient({ account, region, useCache, baseUrl: params.baseUrl });
	const defsManager = await new DefinitionsManager(client).init();

	if (!filePath && !resourceType) {
		return {
			hasErrors: true,
			missingArgs: true,
			defsHelpTable: defsManager.getDefsTableForHelpMsg(),
		};
	}

	const scope = parseScopeParam(scopeParam);

	if (resourceType) {
		log('executing api calls in single delete mode');
		return runSingleDelete({
			resourceType,
			resourceName,
			scope,
			wait,
			forceDelete,
			skipConfirmation,
			defsManager,
			client,
			onConfirmSingleDelete,
			onConfirmForceDelete,
		});
	}

	if (!filePath) {
		throw new Error('file path is required for bulk delete.');
	}

	log('executing api calls in bulk delete mode');
	return runBulkDelete({ filePath, defsManager, client, wait, forceDelete });
}

async function runSingleDelete({
	resourceType,
	resourceName,
	scope,
	wait,
	forceDelete,
	skipConfirmation,
	defsManager,
	client,
	onConfirmSingleDelete,
	onConfirmForceDelete,
}: {
	resourceType: string;
	resourceName?: string;
	scope: ReturnType<typeof parseScopeParam>;
	wait?: boolean;
	forceDelete?: boolean;
	skipConfirmation?: boolean;
	defsManager: DefinitionsManager;
	client: ApiServerClient;
	onConfirmSingleDelete?: (scopeProvided: boolean, matchingDefsLength: number) => Promise<boolean>;
	onConfirmForceDelete?: () => Promise<boolean>;
}): Promise<DeleteCommandResult> {
	const defs = defsManager.findDefsByWord(resourceType);
	if (!defs) {
		throw new Error(`the server doesn't have a resource type "${resourceType}"`);
	}
	if (!resourceName) {
		throw new Error('resource name is required.');
	}
	if (defs.every((def) => !!def.scope) && !scope) {
		throw new Error(
			`scope name param (-s/--scope) is required for the scoped "${defs[0].resource.spec.kind}" resource.`
		);
	}
	verifyScopeParam(defsManager.getAllKindsList(), defs, scope);

	const matchingDefs = defs.filter(
		(def) =>
			(scope && ((scope.kind && scope.kind === def.scope?.spec.kind) || (!scope.kind && !!def.scope))) ||
			(!scope && !def.scope)
	);

	if (!matchingDefs.length) {
		throw new Error('can\'t find matching resource definitions.');
	}

	if (!skipConfirmation && onConfirmSingleDelete) {
		const shouldContinue = await onConfirmSingleDelete(!!scope, matchingDefs.length);
		if (!shouldContinue) {
			return { hasErrors: true };
		}
	}

	if (!skipConfirmation && forceDelete && onConfirmForceDelete) {
		const shouldContinue = await onConfirmForceDelete();
		if (!shouldContinue) {
			return { hasErrors: true };
		}
	}

	const singleResults: ApiServerClientSingleResult[] = await Promise.all(
		matchingDefs.map(async (def) =>
			client.deleteResourceByName({
				resourceDef: def.resource,
				resourceName: resourceName,
				scopeDef: def.scope,
				scopeName: scope?.name,
				wait,
				forceDelete,
			})
		)
	);

	const hasErrors = !singleResults.filter((res) => res.data !== null).length;
	log('single delete complete, hasErrors:', hasErrors);
	return { hasErrors, singleResults };
}

async function runBulkDelete({
	filePath,
	defsManager,
	client,
	wait,
	forceDelete,
}: {
	filePath: string;
	defsManager: DefinitionsManager;
	client: ApiServerClient;
	wait?: boolean;
	forceDelete?: boolean;
}): Promise<DeleteCommandResult> {
	verifyFile(filePath);
	const { docs } = await loadAndVerifySpecs(filePath, defsManager.getAllKindsList());
	const bulkResults = await client.bulkDelete(
		docs as GenericResource[],
		defsManager.getSortedKindsMap(),
		wait,
		forceDelete
	);
	const hasErrors = !!bulkResults.error.length;
	log('bulk delete complete, hasErrors:', hasErrors);
	return { hasErrors, bulkResults };
}
