import logger from '../../logger.js';
import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { DefinitionsManager, FindDefsByWordResult } from '../results/DefinitionsManager.js';
import { getFieldSetFromDefinitionColumns, parseScopeParam, transformSimpleFilters, verifyScopeParam } from '../utils/utils.js';
import { resolveTeamNames } from '../results/resultsrenderer.js';
import { GetCommandParams, GetCommandResult, GetResultItem } from '../types.js';

const log = logger('engage:get-service');

export async function getResources(params: GetCommandParams): Promise<GetCommandResult> {
	const {
		account,
		region,
		useCache,
		team,
		resourceTypes,
		resourceName,
		scopeParam,
		query,
		titleFilter,
		attributeFilter,
		tagFilter,
		teamGuid,
		languageExpand: rawLanguageExpand,
		languageDefinition,
		outputFormat,
		onProgress,
	} = params;

	if (rawLanguageExpand && languageDefinition) {
		throw new Error('You must specify either of the "--language" or "--languageDefinition" argument and not both.');
	}
	if (languageDefinition && !outputFormat) {
		throw new Error('The "--languageDefinition" argument can only be used with output(-o,--output) argument');
	}

	let languageExpand = rawLanguageExpand;
	if (languageExpand) {
		let lang = '';
		let i = 0;
		if (languageExpand.trim() === '*') {
			lang = 'languages-*';
		} else {
			const langCodeArr = languageExpand.split(',');
			langCodeArr.forEach((v) => {
				lang += i < langCodeArr.length - 1
					? `languages-${v.trim()},`
					: `languages-${v.trim()}`;
				i++;
			});
		}
		languageExpand = 'languages,' + lang;
	}

	const formattedFilter = transformSimpleFilters(titleFilter, attributeFilter, tagFilter, teamGuid);
	const resolvedQuery = query ?? formattedFilter;

	if (!resourceTypes.length || !resourceTypes[0]) {
		const client = new ApiServerClient({ account, region, useCache, team });
		const defsManager = await new DefinitionsManager(client).init();
		return {
			items: [],
			hasErrors: true,
			missingResourceArg: true,
			defsHelpTable: defsManager.getDefsTableForHelpMsg(),
			languageDefinition,
		};
	}

	const client = new ApiServerClient({ account, region, useCache, team });
	const defsManager = await new DefinitionsManager(client).init();
	const scope = parseScopeParam(scopeParam);
	const items: GetResultItem[] = [];

	for (const typedResource of resourceTypes) {
		const defs = defsManager.findDefsByWord(typedResource);
		if (!defs) {
			throw new Error(`the server doesn't have a resource type "${typedResource}"`);
		}
		if (defs.every((d) => !!d.scope) && resourceName && !scope) {
			throw new Error(
				`scope name param (-s/--scope) is required for the scoped "${defs[0].resource.spec.kind}" resource.`
			);
		}
		verifyScopeParam(defsManager.getAllKindsList(), defs, scope);

		const progressListener = onProgress
			? (percent: number) => onProgress(percent)
			: undefined;

		if (scope) {
			const results = await Promise.all(
				defs
					.filter((d) => !scope.kind || !d.scope || d.scope.spec.kind === scope.kind)
					.map(async (d) => ({
						response: await client.getListOrByName({
							resourceDef: d.resource,
							scopeName: scope.name,
							resourceName,
							scopeDef: d.scope,
							query: resolvedQuery,
							progressListener,
							expand: languageExpand,
							langDef: languageDefinition,
							fieldSet: outputFormat ? undefined : getFieldSetFromDefinitionColumns(d),
						}),
						cli: d.cli,
					}))
			);
			results.forEach(({ response, cli }) => items.push({ columns: cli.spec.columns, response }));
		} else {
			// deduplicate by resource group — one call per group covers all scopes
			const defsMatchingGroup: { [groupName: string]: FindDefsByWordResult } = {};
			defs.forEach((d) => {
				if (!defsMatchingGroup[d.resource.metadata.scope?.name]) {
					defsMatchingGroup[d.resource.metadata.scope?.name] = d;
				}
			});
			const results = await Promise.all(
				Object.values(defsMatchingGroup).map(async (d) => ({
					response: await client.getListOrByName({
						resourceDef: d.resource,
						scopeName: scope?.name,
						resourceName,
						scopeDef: undefined,
						query: resolvedQuery,
						progressListener,
						expand: languageExpand,
						langDef: languageDefinition,
						fieldSet: outputFormat ? undefined : getFieldSetFromDefinitionColumns(d),
					}),
					cli: d.cli,
				}))
			);
			results.forEach(({ response, cli }) => items.push({ columns: cli.spec.columns, response }));
		}
	}

	for (const item of items) {
		await resolveTeamNames({ ...item, account });
	}

	log('get-service complete, items:', items.length);
	const hasErrors = !items.filter((r) => r.response.data !== null).length;
	return { items, hasErrors, languageDefinition };
}
