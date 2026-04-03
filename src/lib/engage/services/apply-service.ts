import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../results/DefinitionsManager.js';
import { loadAndVerifySpecs, verifyFile } from '../utils/utils.js';
import { ApplyCommandParams, ApplyCommandResult, GenericResource } from '../types.js';

export async function applyResources(params: ApplyCommandParams): Promise<ApplyCommandResult> {
	const { account, region, useCache, filePath, language, subresource, onMissingNames } = params;

	verifyFile(filePath);

	const client = new ApiServerClient({ account, region, useCache });
	const defsManager = await new DefinitionsManager(client).init();

	const { docs, isMissingName } = await loadAndVerifySpecs(filePath, defsManager.getAllKindsList());

	if (isMissingName && onMissingNames) {
		const shouldContinue = await onMissingNames();
		if (!shouldContinue) {
			return { results: [], hasErrors: false };
		}
	}

	const sortedKindsMap = defsManager.getSortedKindsMap();
	const results = await client.bulkCreateOrUpdate(docs as GenericResource[], sortedKindsMap, language, subresource);
	const hasErrors = results.some((r) => (r.error?.length ?? 0) > 0);

	return { results, hasErrors };
}
