import chalk from 'chalk';
import { log } from 'console';
import { dataService } from '../request.js';
import {
	ApiServerClientApplyResult,
	ApiServerClientBulkResult,
	ApiServerClientListResult,
	ApiServerClientSingleResult,
	ApiServerError,
	ApiServerSubResourceOperation,
	ApiServerVersions,
	GenericResource,
	GenericResourceWithoutName,
	LanguageTypes,
	ProgressListener,
	ResourceDefinition,
	WAIT_TIMEOUT,
} from '../types.js';
import {
	buildGenericResource,
	createLanguageSubresourceNames,
	getLatestServedAPIVersion,
	sanitizeMetadata,
	ValueFromKey,
} from '../utils/utils.js';
import pickBy from 'lodash/pickBy.js';
import isEmpty from 'lodash/isEmpty.js';
import assign from 'lodash/assign.js';

export class ApiServerClient {
	region?: string;
	useCache: boolean;
	account?: string;
	team?: string | null;
	forceGetAuthInfo?: boolean;

	/**
   * Init temporary file if "data" is provided - write data to file (as YAML at the moment)
   * @param {object} data optional data to write while creating file
   */
	constructor({
		region,
		account,
		useCache,
		team,
		forceGetAuthInfo,
	}: {
		region?: string;
		useCache?: boolean;
		account?: string;
		team?: string | null;
		forceGetAuthInfo?: boolean;
	} = {}) {
		log(
			`initializing client with params: region = ${region}, account = ${account}, useCache = ${useCache}, team = ${team}`,
		);
		this.account = account;
		this.region = region;
		this.useCache = useCache === undefined ? true : useCache; // using cache by default
		this.team = team;
		this.forceGetAuthInfo = forceGetAuthInfo;
	}

	/**
   * Build resource url based on its ResourceDefinition and passed scope def and name.
   * Note that for scope url part both name and def needed.
   * The returned URL path is expected to be appended to the base URL.
   */
	private buildResourceUrlPath({
		resourceDef,
		resourceName,
		scopeDef,
		scopeName,
		version = ApiServerVersions.v1alpha1,
		forceDelete = false,
		expand,
		langDef,
		fieldSet,
		embed,
	}: {
		resourceDef: ResourceDefinition;
		resourceName?: string;
		scopeDef?: ResourceDefinition;
		scopeName?: string;
		version: string;
		forceDelete?: boolean;
		expand?: string;
		langDef?: string;
		fieldSet?: Set<string>;
		embed?: string;
	}): string {
		const groupUrl = `/${resourceDef.metadata.scope.name}/${version}`;
		const scopeUrl
			= scopeName && scopeDef
				? `/${scopeDef.spec.plural}/${encodeURIComponent(scopeName)}`
				: '';
		const resourceUrl = `/${resourceDef.spec.plural}`;
		const nameUrl = resourceName ? `/${encodeURIComponent(resourceName)}` : '';
		const embedSet = new Set<string>(embed?.split(','));
		const expandSet = new Set<string>(expand?.split(','));
		if (langDef) {
			fieldSet ??= new Set<string>();
			fieldSet
				.add('languages')
				.add('group')
				.add('apiVersion')
				.add('name')
				.add('kind')
				.add('metadata');
			expandSet.add('languages');
			const languageTypesArr: (string | undefined)[] = [];
			Object.keys(LanguageTypes).forEach((key) =>
				languageTypesArr.push(ValueFromKey(LanguageTypes, key)),
			);
			langDef.split(',').forEach((code) => {
				if (languageTypesArr.includes(code)) {
					embedSet.add(`languages-${code.trim()}.resource`);
					expandSet.add(`languages-${code.trim()}`);
					fieldSet!.add(`languages-${code.trim()}.values`);
				} else if (code.trim().length > 0) {
					console.log(
						chalk.yellow(
							`\n\'${code}\' language code is not supported. Allowed language codes: ${LanguageTypes.French} | ${LanguageTypes.German} | ${LanguageTypes.US} | ${LanguageTypes.Portugese}.'`,
						),
					);
				}
			});
		}

		let url = `${groupUrl}${scopeUrl}${resourceUrl}${nameUrl}`;
		if (forceDelete || embedSet.size || expandSet.size || fieldSet) {
			const queryParams: string[] = [];
			if (forceDelete) {
				queryParams.push('forceDelete=true');
			}
			if (embedSet.size) {
				queryParams.push('embed=' + [ ...embedSet ].join(','));
			}
			if (expandSet.size) {
				queryParams.push('expand=' + [ ...expandSet ].join(','));
			}
			if (fieldSet) {
				// If field set is empty, then return no fields. This is intentional.
				queryParams.push('fields=' + [ ...fieldSet ].join(','));
			}
			url += '?' + queryParams.join('&');
		}
		return url;
	}

	/**
   * Generates an array of PUT requests for sub-resources based on resource input
   *
   * @param {Object} args function expects arguments as an object
   * @param {GenericResource} args.resource resource input (not the APIs response)
   * @param {string} args.resourceName resource name
   * @param {string} args.subResourceName subresource name
   * @param {ResourceDefinition} args.resourceDef resource definition
   * @param {string} [args.scopeName] scope name
   * @param {ResourceDefinition} [args.scopeDef] scope definition
   * @param {string} [args.version] api's version
   * @returns {Promise<Array<() => Promise<any> | null>} returns an array of "request creators" functions
   * that will be used in {@link resolveSubResourcesRequests} to create sub-resources when needed
   */
	public async generateSubResourcesRequests({
		resource,
		resourceName,
		subResourceName,
		resourceDef,
		scopeDef,
		scopeName,
		version,
		createAction,
		language,
	}: {
		resource:
      | (GenericResource & { [subresource: string]: any })
      | (GenericResourceWithoutName & { [subresource: string]: any }); // file input, not the response
		resourceName: string;
		subResourceName?: string;
		resourceDef: ResourceDefinition;
		scopeDef?: ResourceDefinition;
		scopeName?: string;
		version: string;
		createAction?: boolean;
		language?: string;
	}): Promise<Array<ApiServerSubResourceOperation> | null> {
		const service = await dataService({
			account: this.account,
		});
		const urlPath = this.buildResourceUrlPath({
			resourceDef,
			resourceName,
			scopeDef,
			scopeName,
			version,
		});
		const knownSubResourcesNames = resourceDef.spec.subResources?.names ?? [];
		const foundSubResources = pickBy(resource, (_, key) => {
			if (key.startsWith('x-') || knownSubResourcesNames.includes(key)) {
				return !subResourceName || subResourceName === key;
			}
			return false;
		});
		if (language) {
			const langSubResourcesNames = createLanguageSubresourceNames(language);
			langSubResourcesNames.forEach((name) => {
				if (
					!Object.keys(foundSubResources).includes(name)
          && name !== 'languages'
				) {
					console.log(
						chalk.yellow(
							`\n\'${name}\' subresource definition not found, hence create/update cannot be performed on \'${name}\' subresource.`,
						),
					);
				}
			});
			Object.keys(foundSubResources).forEach((subRes) => {
				if (!langSubResourcesNames.includes(subRes)) {
					// For create, only delete the language subresources that are not passed in the 'language' argument.
					if (createAction) {
						if (subRes.includes('languages')) {
							delete foundSubResources[subRes];
						}
					}
					// For update, delete all the subresources except the ones passed in the 'language' argument.
					else {
						delete foundSubResources[subRes];
					}
				}
			});
		}
		return isEmpty(foundSubResources)
			? null
			: Object.keys(foundSubResources).map((key) => {
				return {
					name: key,
					operation: () =>
						service
							.put(`${urlPath}/${key}?fields=${key}`, {
								[key]: foundSubResources[key],
							})
							.catch((err) =>
								Promise.reject({ name: key, requestError: err }),
							),
				};
			});
	}

	/**
   * Executes sub-resources requests generated by {@link generateSubResourcesRequests}
   *
   * @param {GenericResource} mainResourceResponse API response of the main resource update/create
   * @param {Array<() => Promise<any>> | null} pendingCalls an array of "request creators" functions for sub-resources
   * @returns {ApiServerClientSingleResult} returns mainResourceResponse merged with successful sub-resources results
   * and error details if encountered
   */
	public async resolveSubResourcesRequests(
		mainResourceResponse: GenericResource,
		pendingCalls: Array<ApiServerSubResourceOperation> | null,
	): Promise<ApiServerClientSingleResult> {
		if (!pendingCalls) {
			return { data: mainResourceResponse, error: null };
		}
		log(`resolving sub-resources, pending calls = ${pendingCalls.length}.`);
		// note: errors set to an empty array initially, will reset to null if no errors found
		const result: ApiServerClientSingleResult = {
			data: null,
			updatedSubResourceNames: [],
			error: [],
		};

		const subResourcesCombined = (
			await Promise.allSettled(
				pendingCalls.map(async (next) => {
					const opResult = await next.operation();
					result.updatedSubResourceNames?.push(next.name);
					return opResult;
				}),
			)
		).reduce((a, c) => {
			if (c.status === 'fulfilled') {
				return { ...a, ...c.value };
			}
			// expecting only a valid ApiServer error response here
			// re-throw if something different, so it should be handled by command's catch block.
			if (
				c.reason.requestError?.errors
        && Array.isArray(c.reason.requestError.errors)
			) {
				// note: if APIs are going to return more details this details override will not be needed, just push as in other methods
				result.error?.push(
					...c.reason.requestError.errors.map((e: ApiServerError) => ({
						...e,
						detail: `sub-resource "${c.reason.name}" ${e.detail}`,
					})),
				);
				return a;
			}
			throw c.reason;
		}, {});

		result.data = assign(mainResourceResponse, subResourcesCombined);
		if (!result.error?.length) { result.error = null; } // reset errors to null if none encountered
		log(
			`resolving sub-resources is complete, data received = ${!isEmpty(subResourcesCombined)}, errors = ${
				result.error?.length
			}.`,
		);
		return result;
	}

	/**
   * Check if resources are deleted by making a fetch call for the resources
   */
	private checkForResources(
		resources: GenericResource[],
		sortedDefsArray: ResourceDefinition[],
	) {
		return Promise.all(
			resources.map((resource) => {
				const resourceDef = sortedDefsArray.find(
					(def) =>
						def.spec.kind === resource.kind
            && def.spec.scope?.kind === resource.metadata?.scope?.kind,
				);
				const scopeDef = resource.metadata?.scope
					? sortedDefsArray.find(
						(def) =>
							def.spec.kind === resource.metadata!.scope!.kind
                && !def.spec.scope,
					)
					: undefined;
				const scopeName = resource.metadata?.scope?.name;
				if (resourceDef) {
					return this.getResourceByName({
						resourceDef,
						resourceName: resource.name,
						scopeDef,
						scopeName,
					});
				} else { return null; }
			}),
		);
	}

	/**
   * SINGLE RESOURCE CALLS
   */

	/**
   * Create a single resource.
   * @param resources resource to create
   */
	async createResource({
		resourceDef,
		resource,
		scopeDef,
		scopeName,
		withSubResources = true,
		language,
	}: {
		resource: GenericResource | GenericResourceWithoutName;
		resourceDef: ResourceDefinition;
		scopeName?: string;
		scopeDef?: ResourceDefinition;
		withSubResources?: boolean;
		language?: string;
	}): Promise<ApiServerClientSingleResult> {
		log(
			`createResource, spec.kind = ${resourceDef.spec.kind}, name = ${resource.name}`,
		);
		const result: ApiServerClientSingleResult = {
			data: null,
			error: null,
			pending: null,
			warning: false,
		};
		try {
			const service = await dataService({
				account: this.account,
			});
			const version
				= resource.apiVersion === undefined
					? getLatestServedAPIVersion(resourceDef)
					: resource.apiVersion;
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				scopeDef,
				scopeName,
				version,
			});
			const response = await service.post(urlPath, sanitizeMetadata(resource));
			if (!resource.name) {
				log('createResource, resource does not have a logical name');
				result.warning = true;
			}
			const pendingSubResources = await this.generateSubResourcesRequests({
				resource,
				resourceName: response.name,
				resourceDef,
				scopeDef,
				scopeName,
				version,
				createAction: true,
				language,
			});
			log(
				`createResource, pendingSubResources = ${pendingSubResources?.length}`,
			);
			if (withSubResources) {
				const { data: subResData, error: subResError }
					= await this.resolveSubResourcesRequests(response, pendingSubResources);
				result.data = subResData;
				result.error = subResError;
			} else {
				result.data = response;
				result.pending = pendingSubResources;
			}
		} catch (e: any) {
			log('createResource, error: ', e);
			// expecting only a valid ApiServer error response here
			// re-throw if something different, so it should be handled by command's catch block.
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		if (result.data) {
			result.data = sanitizeMetadata(result.data);
		}
		return result;
	}

	/**
   * Update a single resource.
   * @param resources resource to create
   */
	async updateResource({
		resourceDef,
		resource,
		scopeDef,
		scopeName,
		subResourceName,
		language,
	}: {
		resource: GenericResource;
		resourceDef: ResourceDefinition;
		scopeName?: string;
		scopeDef?: ResourceDefinition;
		subResourceName?: string;
		language?: string;
	}): Promise<ApiServerClientSingleResult> {
		log(
			`updateResource, spec.kind = ${resourceDef.spec.kind}, name = ${resource.name}`,
		);
		const result: ApiServerClientSingleResult = {
			data: null,
			error: null,
			pending: null,
		};
		const canUpdateMainResource = !language && !subResourceName;
		const version
			= resource.apiVersion === undefined
				? getLatestServedAPIVersion(resourceDef)
				: resource.apiVersion;
		if (canUpdateMainResource) {
			try {
				const service = await dataService({
					account: this.account,
				});
				const urlPath = this.buildResourceUrlPath({
					resourceDef,
					resourceName: resource.name,
					scopeDef,
					scopeName,
					version,
				});
				result.data = await service.put(urlPath, sanitizeMetadata(resource));
			} catch (e: any) {
				log('updateResource, error', e);
				// expecting only a valid ApiServer error response here
				// re-throw if something different, so it should be handled by command's catch block.
				if (e.errors && Array.isArray(e.errors)) {
					result.error = e.errors;
				} else {
					throw e;
				}
			}
		}
		result.pending = await this.generateSubResourcesRequests({
			resource,
			resourceName: resource.name,
			subResourceName,
			resourceDef,
			scopeDef,
			scopeName,
			version,
			createAction: false,
			language,
		});
		if (!result.data && !result.pending && subResourceName) {
			result.error = [
				{
					status: 0,
					title: '',
					detail: `sub-resource "${subResourceName}" not found.`,
					meta: {
						instanceId: '',
						tenantId: '',
						authenticatedUserId: '',
						transactionId: '',
					},
				},
			];
		}
		if (result.data) {
			result.data = sanitizeMetadata(result.data);
		}
		return result;
	}

	/**
   * Update sub resource on the resource.
   * @param resources resource to be updated
   * @param subResourceName sub resource name to be updated
   */
	async updateSubResource({
		resourceDef,
		resource,
		subResourceName,
		scopeDef,
		scopeName,
	}: {
		resource: GenericResource;
		subResourceName: string;
		resourceDef: ResourceDefinition;
		scopeName?: string;
		scopeDef?: ResourceDefinition;
		withSubResources?: boolean;
	}): Promise<ApiServerClientSingleResult> {
		log(
			`updateSubResource, spec.kind = ${resourceDef.spec.kind}, name = ${resource.name}`,
		);
		const result: ApiServerClientSingleResult = {
			data: null,
			error: null,
			pending: null,
		};
		const version = getLatestServedAPIVersion(resourceDef);
		try {
			const service = await dataService({
				account: this.account,
			});
			const knownSubResourcesNames = resourceDef.spec.subResources?.names ?? [];
			const foundSubResources = pickBy(
				resource,
				(_, key) =>
					subResourceName == key && knownSubResourcesNames.includes(key),
			);
			const resourceName = resource.name;
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				resourceName,
				scopeDef,
				scopeName,
				version,
			});

			service.put(`${urlPath}/${subResourceName}?fields=${subResourceName}`, {
				[subResourceName]: foundSubResources[subResourceName],
			});
		} catch (e: any) {
			log('updateSubResource, error', e);
			// expecting only a valid ApiServer error response here
			// re-throw if something different, so it should be handled by command's catch block.
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		if (result.data) { result.data = sanitizeMetadata(result.data); }
		return result;
	}

	/**
   * Delete a resources by name.
   * @param opts = {
   *   resourceDef - required, resource definition
   *   resourceName - required
   *   scopeDef - optional scope resource definition, used only if @param opts.scopeName provided too
   *   scopeName - optional name of the scope, used only if scoped @param opts.scopeDef provided too
   *   version - apis version (using alpha1 by default currently)
   *   wait - if provided, a followup GET call will be executed to confirm if the resource removed.
   * }
   */
	async deleteResourceByName({
		resourceDef,
		resourceName,
		scopeDef,
		scopeName,
		wait,
		forceDelete = false,
		resourceAPIVersion,
	}: {
		resourceDef: ResourceDefinition;
		resourceName: string;
		scopeDef?: ResourceDefinition;
		scopeName?: string;
		wait?: boolean;
		forceDelete?: boolean;
		resourceAPIVersion?: string | undefined;
	}): Promise<ApiServerClientSingleResult> {
		log(
			`deleteResourceByName, spec.kind = ${resourceDef.spec.kind}, name = ${resourceName}, scope.kind = ${scopeDef?.spec.kind}, scope.name = ${scopeName}`,
		);
		const result: ApiServerClientSingleResult = { data: null, error: null };
		const version
			= resourceAPIVersion === undefined
				? getLatestServedAPIVersion(resourceDef)
				: resourceAPIVersion;
		try {
			const service = await dataService({
				account: this.account,
			});
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				resourceName,
				scopeDef,
				scopeName,
				version,
				forceDelete,
			});
			const response = await service.delete(urlPath);
			// note: delete "response" value from api-server is translated to an empty string currently.
			// If its true, constructing a simple representation from provided data (definition, name, scope name)
			// and manually set it as the "data" key.
			result.data
				= response === ''
					? buildGenericResource({ resourceDef, resourceName, scopeName })
					: response;
			if (wait) {
				await new Promise((resolve) =>
					setTimeout(async () => {
						const res = await this.getResourceByName({
							resourceDef,
							resourceName,
							scopeDef,
							scopeName,
						});
						if (res.data) {
							result.data = null;
							result.error = [
								{
									detail: 'resource has not been deleted yet.',
									status: 0,
								} as ApiServerError,
							];
						}
						resolve({});
					}, WAIT_TIMEOUT),
				);
			}
		} catch (e: any) {
			log('deleteResourceByName, error: ', e);
			// expecting only a valid ApiServer error response here
			// re-throw if something different so it should be handled by command's catch block.
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		return result;
	}

	/**
   * Get resources count.
   * @param opts = {
   *   resourceDef - required, resource definition
   *   resourceName - optional, resource name
   *   scopeDef - optional scope resource definition, used only if @param opts.scopeName provided too
   *   scopeName - optional name of the scope, used only if scoped @param opts.scopeDef provided too
   *   query - Optional RSQL query filter
   * }
   */
	async getResourceCount({
		resourceDef,
		resourceName,
		scopeDef,
		scopeName,
		query,
	}: {
		resourceDef: ResourceDefinition;
		resourceName?: string;
		scopeDef?: ResourceDefinition;
		scopeName?: string;
		query?: string;
	}): Promise<string> {
		const version = getLatestServedAPIVersion(resourceDef);
		try {
			const service = await dataService({
				account: this.account,
			});
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				resourceName,
				scopeDef,
				scopeName,
				version,
			});
			const response = await service.head(urlPath, { query });
			return response;
		} catch (e: any) {
			log('getResourceCount, error: ', e);
			// re-throw
			throw e;
		}
	}

	/**
   * Get a resources list.
   * @param opts = {
   *   resourceDef - required, resource definition
   *   scopeDef - optional scope resource definition, used only if @param opts.scopeName provided too
   *   scopeName - optional name of the scope, used only if scoped @param opts.scopeDef provided too
   *   version - apis version (using alpha1 by default currently)
   *   query - Optional RSQL query filter
   *   progressListener - Optional callback invoked multiple times with download progress
   * }
   */
	async getResourcesList({
		resourceDef,
		scopeDef,
		scopeName,
		query,
		progressListener,
		expand,
		langDef,
		fieldSet,
	}: {
		resourceDef: ResourceDefinition;
		scopeDef?: ResourceDefinition;
		scopeName?: string;
		query?: string;
		progressListener?: ProgressListener;
		expand?: string;
		langDef?: string;
		fieldSet?: Set<string>;
	}): Promise<ApiServerClientListResult> {
		log(`getResourcesList, spec.kind = ${resourceDef.spec.kind}`);
		const version = getLatestServedAPIVersion(resourceDef);
		const result: ApiServerClientListResult = { data: null, error: null };
		try {
			const service = await dataService({
				account: this.account,
			});
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				scopeDef,
				scopeName,
				version,
				expand,
				langDef,
				fieldSet,
			});
			const response = await service.getWithPagination(
				urlPath,
				{ query },
				50,
				progressListener,
			);
			result.data = response;
		} catch (e: any) {
			log('getResourcesList, error: ', e);
			// expecting only a valid ApiServer error response here
			// re-throw if something different so it should be handled by command's catch block.
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		return result;
	}

	/**
   * Get a resources by name.
   * @param opts = {
   *   resourceDef - required, resource definition
   *   resourceName - required
   *   scopeDef - optional scope resource definition, used only if @param opts.scopeName provided too
   *   scopeName - optional name of the scope, used only if scoped @param opts.scopeDef provided too
   *   version - apis version (using alpha1 by default currently)
   * }
   */
	async getResourceByName({
		resourceDef,
		resourceName,
		scopeDef,
		scopeName,
		expand,
		langDef,
		fieldSet,
		resourceVersion,
		embed,
	}: {
		resourceDef: ResourceDefinition;
		resourceName: string;
		scopeDef?: ResourceDefinition;
		scopeName?: string;
		expand?: string;
		langDef?: string;
		fieldSet?: Set<string>;
		resourceVersion?: string;
		embed?: string;
	}): Promise<ApiServerClientSingleResult> {
		log(
			`getResourceByName, spec.kind = ${resourceDef.spec.kind}, name = ${resourceName}`,
		);
		const version
			= resourceVersion === undefined
				? getLatestServedAPIVersion(resourceDef)
				: resourceVersion;
		const result: ApiServerClientSingleResult = { data: null, error: null };
		try {
			const service = await dataService({
				account: this.account,
			});
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				resourceName,
				scopeDef,
				scopeName,
				version,
				expand,
				langDef,
				fieldSet,
				embed: embed,
			});
			const response = await service.get(urlPath);
			result.data = response;
		} catch (e: any) {
			log('getResourceByName, error: ', e);
			// expecting only a valid ApiServer error response here
			// re-throw if something different so it should be handled by command's catch block.
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		return result;
	}

	// TODO: Implement this when Caching is done

	//   /**
	//    * Fetch definition endpoints to get specs for available resources.
	//    * Note that only "management" group is used currently.
	//    * @returns { group1: { resources: Map, cli: Map }, group2: { ... }, groupN: { ... } }
	//    */
	//   async getSpecs(version = ApiServerVersions.v1alpha1): Promise<{
	//     [groupName: string]: {
	//       resources: Map<string, ResourceDefinition>;
	//       cli: Map<string, CommandLineInterface>;
	//     };
	//   }> {
	//     log(`get specs`);
	//     try {
	//       const specs: {
	//         [groupName: string]: {
	//           resources: Map<string, ResourceDefinition>;
	//           cli: Map<string, CommandLineInterface>;
	//         };
	//       } = {};

	//       const service = await dataService({
	//         baseUrl: this.baseUrl,
	//         region: this.region,
	//         account: this.account,
	//       });
	//       const groups = await service.getWithPagination(
	//         `/definitions/${version}/groups`,
	//       );
	//       for (const group of groups) {
	//         let resources: ResourceDefinition[] = [];
	//         let cli: CommandLineInterface[] = [];
	//         const cachedGroup = CacheController.get(
	//           `groups-${group.name}-${version}`,
	//         );
	//         let cacheUpdated = false;
	//         if (
	//           this.useCache &&
	//           cachedGroup &&
	//           cachedGroup.resourceVersion === group.metadata.resourceVersion
	//         ) {
	//           log(`valid ${group.name}/${version} found in cache`);
	//           resources = cachedGroup.resources;
	//           cli = cachedGroup.cli;
	//         } else {
	//           log(
	//             `no valid ${group.name}/${version} found in cache or cache usage is not set`,
	//           );
	//           [resources, cli] = await Promise.all([
	//             service.getWithPagination(
	//               `/definitions/${version}/groups/${group.name}/resources`,
	//             ),
	//             service.getWithPagination(
	//               `/definitions/${version}/groups/${group.name}/commandlines`,
	//             ),
	//           ]);
	//           CacheController.set(`groups-${group.name}-${version}`, {
	//             resourceVersion: group.metadata.resourceVersion,
	//             resources,
	//             cli,
	//           });
	//           cacheUpdated = true;
	//         }
	//         specs[group.name] = {
	//           resources: new Map<string, ResourceDefinition>(),
	//           cli: new Map<string, CommandLineInterface>(),
	//         };
	//         for (const r of resources) {
	//           specs[group.name].resources.set(r.name, r);
	//         }
	//         for (const c of cli) {
	//           specs[group.name].cli.set(c.name, c);
	//         }
	//         if (cacheUpdated) CacheController.writeToFile();
	//       }
	//       return specs;
	//     } catch (e: any) {
	//       log("get specs, error: ", e);
	//       throw e;
	//     }
	//   }

	/**
   * BULK CALLS
   */

	/**
   * Bulk creation of resources.
   * There is no endpoint for bulk create so executing them one-by-one. Order of calls calculated by
   * sorting of the array of resources with "compareResourcesByKindAsc".
   * @param resources array of resources to create
   */
	async bulkCreate(
		resources: Array<GenericResourceWithoutName | GenericResource>,
		sortedDefsMap: Map<string, ResourceDefinition>,
		exitOnError: boolean = false,
	): Promise<ApiServerClientBulkResult> {
		log('bulk create');
		const sortedDefsArray = Array.from(sortedDefsMap.values());
		const pendingSubResources: {
			mainResult: GenericResource;
			pendingCalls: Array<ApiServerSubResourceOperation>;
			withWarning: boolean;
		}[] = [];
		const bulkResult: ApiServerClientBulkResult = {
			success: [],
			error: [],
			warning: [],
		};

		for (const resource of resources) {
			const resourceDef = sortedDefsArray.find(
				(def) =>
					def.spec.kind === resource.kind
          && def.spec.scope?.kind === resource.metadata?.scope?.kind,
			);
			if (!resourceDef) {
				let errorMessage = `No resource definition found for "kind/${resource.kind}"`;
				if (resource.metadata?.scope?.kind) {
					errorMessage += ` in the scope "${resource.metadata?.scope?.kind}".`;
				} else {
					errorMessage += ' with no scope.';
				}
				bulkResult.error.push({
					name: resource.name || 'Unknown name',
					kind: resource.kind,
					error: new Error(errorMessage),
				});
				continue;
			}

			const scopeDef = resource.metadata?.scope
				? sortedDefsArray.find(
					(def) =>
						def.spec.kind === resource.metadata!.scope!.kind
              && !def.spec.scope,
				)
				: undefined;
			const scopeName = resource.metadata?.scope?.name;

			const res = await this.createResource({
				resource,
				resourceDef,
				scopeDef,
				scopeName,
			});
			if (res.data && !res.error) {
				// note: bulk operation requires creation of sub-resources after all main resources created
				// since a sub-resource might have a reference to another resource.
				if (res.pending) {
					pendingSubResources.push({
						mainResult: res.data,
						pendingCalls: res.pending,
						withWarning: res.warning ?? false,
					});
				} else if (res.warning) { bulkResult.warning?.push(res.data); } else { bulkResult.success.push(res.data); }
			} else if (res.error) {
				for (const nextError of res.error) {
					bulkResult.error.push({
						name: resource.name || 'Unknown name',
						kind: resource.kind,
						error: nextError,
					});
				}
				if (exitOnError) {
					return bulkResult;
				}
			}
		}

		// creating sub-resources
		for (const p of pendingSubResources) {
			const subResResult = await this.resolveSubResourcesRequests(
				p.mainResult,
				p.pendingCalls,
			);
			if (subResResult.data && !subResResult.error) {
				if (p.withWarning) { bulkResult.warning?.push(subResResult.data); } else { bulkResult.success.push(subResResult.data); }
			} else if (subResResult.error) {
				for (const nextError of subResResult.error) {
					bulkResult.error.push({
						name: p.mainResult.name,
						kind: p.mainResult.kind,
						error: nextError,
					});
				}
			}
		}

		return bulkResult;
	}

	/**
   * Bulk creation of resources.
   * There is no endpoint for bulk create so executing them one-by-one. Order of calls calculated by
   * sorting of the array of resources with "compareResourcesByKindAsc".
   * @param resources array of resources to create
   */
	async bulkCreateOrUpdate(
		resources: GenericResourceWithoutName[],
		sortedDefsMap: Map<string, ResourceDefinition>,
		language?: string,
		subResourceName?: string,
	): Promise<Array<ApiServerClientApplyResult>> {
		log('bulk create or update');
		const sortedDefsArray = Array.from(sortedDefsMap.values());
		const applyResults: Array<ApiServerClientApplyResult> = [];

		for (const resource of resources) {
			const resourceDef = sortedDefsArray.find(
				(def) =>
					def.spec.kind === resource.kind
          && def.spec.scope?.kind === resource.metadata?.scope?.kind,
			);
			// the check below is already happening when loading the specs but checking again just in case.
			if (!resourceDef) {
				let errorMessage = `No resource definition found for "kind/${resource.kind}"`;
				if (resource.metadata?.scope?.kind) {
					errorMessage += ` in the scope "${resource.metadata?.scope?.kind}".`;
				} else {
					errorMessage += ' with no scope.';
				}
				applyResults.push({
					error: [
						{
							name: resource.name ?? 'Unknown name',
							kind: resource.kind,
							error: new Error(errorMessage),
						},
					],
				});
				continue;
			}

			const scopeDef = resource.metadata?.scope
				? sortedDefsArray.find(
					(def) =>
						def.spec.kind === resource.metadata!.scope!.kind
              && !def.spec.scope,
				)
				: undefined;
			const scopeName = resource.metadata?.scope?.name;
			const resourceName = resource.name ?? 'Unknown name';

			// only making getResource call if resource has a name
			const getResult: ApiServerClientSingleResult | null = resource.name
				? await this.getResourceByName({
					resourceDef,
					resourceName: resource.name,
					scopeDef,
					scopeName,
					resourceVersion: resource.apiVersion,
				})
				: null;

			// Create new resources first
			let singleResult: ApiServerClientSingleResult;
			const shouldCreate
				= !getResult || (!!getResult?.error && getResult.error[0].status === 404);
			if (shouldCreate) {
				// Resource not found. Create a new resource.
				singleResult = await this.createResource({
					resource,
					resourceDef,
					scopeDef,
					scopeName,
					language,
				});
			} else if (getResult!.data) {
				// Resource found. Update the existing resource.
				singleResult = await this.updateResource({
					resource: resource as GenericResource,
					resourceDef,
					scopeDef,
					scopeName,
					language,
					subResourceName,
				});
			} else {
				// Something is going wrong - more than one error in api server response, re-throw in the same
				// structure as ApiServerErrorResponse so renderer.anyError can pick this up.
				throw { errors: getResult!.error };
			}

			// Store the results of the above create/update.
			const applyResult: ApiServerClientApplyResult = {
				data: singleResult.data,
				wasCreated: shouldCreate && !!singleResult.data,
				wasAutoNamed: shouldCreate && singleResult.warning,
				wasMainResourceChanged: !!singleResult.data,
				error: [],
			};
			singleResult.error?.forEach((nextError) =>
				applyResult.error?.push({
					name: resourceName,
					kind: resource.kind,
					error: nextError,
				}),
			);
			applyResults.push(applyResult);

			// Create or update any pending subresources.
			if (singleResult.pending) {
				const pendingData
					= singleResult.data
          ?? sanitizeMetadata(
          	buildGenericResource({
          		resourceName: resourceName,
          		resourceDef: resourceDef,
          		scopeName: scopeName,
          	}) as GenericResource,
          );
				const subResResult = await this.resolveSubResourcesRequests(
					pendingData,
					singleResult.pending,
				);
				if (subResResult.data) {
					applyResult.data = subResResult.data;
				}
				applyResult.updatedSubResourceNames
					= subResResult.updatedSubResourceNames;
				subResResult.error?.forEach((error) =>
					applyResult.error?.push({
						name: resourceName,
						kind: resource.kind,
						error: error,
					}),
				);
			}

			// Delete the result's error array if it is empty.
			if (!applyResult.error?.length) {
				delete applyResult.error;
			}
		}

		return applyResults;
	}

	/**
   * Bulk deletion of resources.
   * Order of calls calculated by sorting of the array of resources with "compareResourcesByKindDesc".
   * @param resources array of resources to create
   */
	async bulkDelete(
		resources: GenericResource[],
		sortedDefsMap: Map<string, ResourceDefinition>,
		wait?: boolean,
		forceDelete?: boolean,
	): Promise<ApiServerClientBulkResult> {
		log('bulk delete');
		const sortedDefsArray = Array.from(sortedDefsMap.values());
		const bulkResult: ApiServerClientBulkResult = { success: [], error: [] };
		for (const resource of resources) {
			try {
				const resourceDef = sortedDefsArray.find(
					(def) =>
						def.spec.kind === resource.kind
            && def.spec.scope?.kind === resource.metadata?.scope?.kind,
				);
				const scopeDef = resource.metadata?.scope
					? sortedDefsArray.find(
						(def) =>
							def.spec.kind === resource.metadata!.scope!.kind
                && !def.spec.scope,
					)
					: undefined;
				const scopeName = resource.metadata?.scope?.name;
				if (!resourceDef) {
					let errorMessage = `No resource definition found for "kind/${resource.kind}"`;
					if (resource.metadata?.scope?.kind) {
						errorMessage += ` in the scope "${resource.metadata?.scope?.kind}".`;
					} else {
						errorMessage += ' with no scope.';
					}
					bulkResult.error.push({
						name: resource.name || 'Unknown name',
						kind: resource.kind,
						error: new Error(errorMessage),
					});
					continue;
				}

				const res = await this.deleteResourceByName({
					resourceName: resource.name,
					resourceDef,
					scopeDef,
					scopeName,
					forceDelete,
					resourceAPIVersion: resource.apiVersion,
				});
				if (res.error) {
					for (const nextError of res.error) {
						bulkResult.error.push({
							name: resource.name,
							kind: resource.kind,
							error: nextError,
						});
					}
				} else {
					// deleteResourceByName is constructing a resource representation using buildGenericResource as res.data,
					// but provided in a file resources might contain more data so using them currently
					bulkResult.success.push(resource);
				}
			} catch (e: any) {
				// expecting only a valid ApiServer error response here
				// re-throw if something different so it should be handled by command's catch block.
				if (e.errors && Array.isArray(e.errors)) {
					for (const nextError of e.errors) {
						bulkResult.error.push({
							name: resource.name,
							kind: resource.kind,
							error: nextError,
						});
					}
				} else {
					throw e;
				}
			}
		}
		if (wait) {
			let pendingResources: (ApiServerClientSingleResult | null)[] = [];
			pendingResources = await this.checkForResources(
				resources,
				sortedDefsArray,
			);
			const pendingDeletingResource = pendingResources.some((res) => res?.data);
			if (pendingDeletingResource) {
				setTimeout(async () => {
					pendingResources = await this.checkForResources(
						resources,
						sortedDefsArray,
					);
				}, WAIT_TIMEOUT);
				const stillPending = pendingResources.some((res) => res?.data);
				if (stillPending) {
					const pendingResNames = pendingResources.map(
						(res) => res?.data?.name,
					);
					bulkResult.success.forEach(
						(res, index) =>
							pendingResNames.includes(res.name)
              && bulkResult.success.splice(index, 1),
					);
					pendingResources.forEach((res) => {
						if (res?.data) {
							bulkResult.error.push({
								...res.data,
								error: {
									detail: 'Not deleted yet.',
								},
							});
						}
					});
				} else { return bulkResult; }
			} else { return bulkResult; }
		}
		return bulkResult;
	}
}
