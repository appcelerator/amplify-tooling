import chalk from 'chalk';
import { dataService } from '../../request.js';
import {
	ApiServerClientApplyResult,
	ApiServerClientBulkResult,
	ApiServerClientListResult,
	ApiServerClientSingleResult,
	ApiServerError,
	ApiServerSubResourceOperation,
	ApiServerVersions,
	BasePaths,
	CommandLineInterface,
	GenericResource,
	GenericResourceWithoutName,
	LanguageTypes,
	ProdBaseUrls,
	ProgressListener,
	Regions,
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
import { CacheController } from '../cache/CacheController.js';
import logger from '../../logger.js';
import { loadConfig } from '../../config.js';
import { Account } from '../../../types.js';

export class ApiServerClient {
	region?: string;
	useCache: boolean;
	account: Account;
	team?: string | null;
	forceGetAuthInfo?: boolean;
	private _baseUrl?: string;

	constructor({
		account,
		region,
		useCache,
		team,
		forceGetAuthInfo,
		baseUrl,
	}: {
		account: Account;
		region?: string;
		useCache?: boolean;
		team?: string | null;
		forceGetAuthInfo?: boolean;
		baseUrl?: string;
	}) {
		const log = logger('ApiServerClient.constructor');
		log.info(
			'initializing client with params:',
		);
		this.account = account;
		this.region = region;
		this.useCache = useCache === undefined ? true : useCache;
		this.team = team;
		this.forceGetAuthInfo = forceGetAuthInfo;
		if (baseUrl) {
			this._baseUrl = baseUrl + BasePaths.ApiServer;
		}
	}

	private async initializeDataService() {
		if (this._baseUrl === undefined) {
			const config = await loadConfig();
			const envBaseUrl = process.env.AXWAY_CENTRAL_BASE_URL || config.get('engage.baseUrl');
			if (envBaseUrl) {
				this._baseUrl = envBaseUrl + BasePaths.ApiServer;
			} else {
				const regionKey = String(
					this.region || this.account?.org?.region || Regions.US
				).toUpperCase() as Regions;
				const prodBaseUrl = ProdBaseUrls[regionKey];
				if (!prodBaseUrl) {
					throw new Error(
						'Unknown region provided, check your region config, should be one of: ' + Object.keys(ProdBaseUrls).join(', ')
					);
				}
				this._baseUrl = prodBaseUrl + BasePaths.ApiServer;
			}
		}
		return dataService({ account: this.account, baseUrl: this._baseUrl });
	}

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
		const log = logger('ApiServerClient.buildResourceUrlPath');
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
							`\n'${code}' language code is not supported. Allowed language codes: ${LanguageTypes.French} | ${LanguageTypes.German} | ${LanguageTypes.US} | ${LanguageTypes.Portugese}.'`,
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
				queryParams.push('fields=' + [ ...fieldSet ].join(','));
			}
			url += '?' + queryParams.join('&');
		}
		log.info(`built url path: ${url}`);
		return url;
	}

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
            | (GenericResourceWithoutName & { [subresource: string]: any });
		resourceName: string;
		subResourceName?: string;
		resourceDef: ResourceDefinition;
		scopeDef?: ResourceDefinition;
		scopeName?: string;
		version: string;
		createAction?: boolean;
		language?: string;
	}): Promise<Array<ApiServerSubResourceOperation> | null> {
		const log = logger('ApiServerClient.generateSubResourcesRequests');
		log.info(
			`generateSubResourcesRequests, spec.kind = ${resourceDef.spec.kind}, resourceName = ${resourceName}`,
		);
		const service = await this.initializeDataService();
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
							`\n'${name}' subresource definition not found, hence create/update cannot be performed on '${name}' subresource.`,
						),
					);
				}
			});
			Object.keys(foundSubResources).forEach((subRes) => {
				if (!langSubResourcesNames.includes(subRes)) {
					if (createAction) {
						if (subRes.includes('languages')) {
							delete foundSubResources[subRes];
						}
					} else {
						delete foundSubResources[subRes];
					}
				}
			});
		}
		const result = isEmpty(foundSubResources)
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
							// eslint-disable-next-line promise/no-return-wrap
								Promise.reject({ name: key, requestError: err }),
							),
				};
			});
		log.info(`generateSubResourcesRequests, found sub-resources = ${result?.length ?? 0}`);
		return result;
	}

	public async resolveSubResourcesRequests(
		mainResourceResponse: GenericResource,
		pendingCalls: Array<ApiServerSubResourceOperation> | null,
	): Promise<ApiServerClientSingleResult> {
		const log = logger('ApiServerClient.resolveSubResourcesRequests');
		if (!pendingCalls) {
			return { data: mainResourceResponse, error: null };
		}
		log.info(`resolving sub-resources, pending calls = ${pendingCalls.length}.`);
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
			if (
				c.reason.requestError?.errors
                && Array.isArray(c.reason.requestError.errors)
			) {
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
		if (!result.error?.length) {
			result.error = null;
		}
		log.info(
			`resolving sub-resources is complete, data received = ${!isEmpty(subResourcesCombined)}, errors = ${result.error?.length}.`,
		);
		return result;
	}

	private checkForResources(
		resources: GenericResource[],
		sortedDefsArray: ResourceDefinition[],
	) {
		const log = logger('ApiServerClient.checkForResources');
		log.info(`checkForResources, resources count = ${resources.length}`);
		return Promise.all(
			resources.map((resource) => {
				const resourceDef = sortedDefsArray.find(
					(def) =>
						def.spec?.kind === resource.kind
                        && def.spec?.scope?.kind === resource.metadata?.scope?.kind,
				);
				const scopeDef = resource.metadata?.scope
					? sortedDefsArray.find(
						(def) =>
							def.spec?.kind === resource.metadata!.scope!.kind
                            && !def.spec?.scope,
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
				} else {
					return null;
				}
			}),
		);
	}

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
		const log = logger('ApiServerClient.createResource');
		log.info(
			`createResource, spec.kind = ${resourceDef.spec.kind}, name = ${resource.name}`,
		);
		const result: ApiServerClientSingleResult = {
			data: null,
			error: null,
			pending: null,
			warning: false,
		};
		try {
			const service = await this.initializeDataService();
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
				log.info('createResource, resource does not have a logical name');
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
			log.info(
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
			log.error('createResource, error: ', e);
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		if (result.data) {
			result.data = sanitizeMetadata(result.data);
		}
		return result;
	}

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
		const log = logger('ApiServerClient.updateResource');
		log.info(
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
				const service = await this.initializeDataService();
				const urlPath = this.buildResourceUrlPath({
					resourceDef,
					resourceName: resource.name,
					scopeDef,
					scopeName,
					version,
				});
				result.data = await service.put(urlPath, sanitizeMetadata(resource));
			} catch (e: any) {
				log.error('updateResource, error', e);
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
		const log = logger('ApiServerClient.updateSubResource');
		log.info(
			`updateSubResource, spec.kind = ${resourceDef.spec.kind}, name = ${resource.name}`,
		);
		const result: ApiServerClientSingleResult = {
			data: null,
			error: null,
			pending: null,
		};
		const version = getLatestServedAPIVersion(resourceDef);
		try {
			const service = await this.initializeDataService();
			const knownSubResourcesNames = resourceDef.spec.subResources?.names ?? [];
			const foundSubResources = pickBy(
				resource,
				(_, key) =>
					subResourceName === key && knownSubResourcesNames.includes(key),
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
			log.error('updateSubResource, error', e);
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		if (result.data) {
			result.data = sanitizeMetadata(result.data);
		}
		return result;
	}

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
		const log = logger('ApiServerClient.deleteResourceByName');
		log.info(
			`deleteResourceByName, spec.kind = ${resourceDef.spec.kind}, name = ${resourceName}, scope.kind = ${scopeDef?.spec.kind}, scope.name = ${scopeName}`,
		);
		const result: ApiServerClientSingleResult = { data: null, error: null };
		const version
			= resourceAPIVersion === undefined
				? getLatestServedAPIVersion(resourceDef)
				: resourceAPIVersion;
		try {
			const service = await this.initializeDataService();
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				resourceName,
				scopeDef,
				scopeName,
				version,
				forceDelete,
			});
			const response = await service.delete(urlPath);
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
			log.error('deleteResourceByName, error: ', e);
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		return result;
	}

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
		const log = logger('ApiServerClient.getResourceCount');
		log.info(`getResourceCount, spec.kind = ${resourceDef.spec.kind}`);
		const version = getLatestServedAPIVersion(resourceDef);
		try {
			const service = await this.initializeDataService();
			const urlPath = this.buildResourceUrlPath({
				resourceDef,
				resourceName,
				scopeDef,
				scopeName,
				version,
			});
			const response = await service.head(urlPath, query ? { searchParams: { query } } : {});
			return response;
		} catch (e: any) {
			log.error('getResourceCount, error: ', e);
			throw e;
		}
	}

	async getListOrByName({ resourceDef,
		scopeName,
		resourceName,
		scopeDef,
		query,
		progressListener,
		expand,
		langDef,
		fieldSet }: {
		resourceDef: ResourceDefinition,
		scopeName?: string,
		resourceName?: string,
		scopeDef?: ResourceDefinition,
		query?: string,
		progressListener?: ProgressListener,
		expand?: string,
		langDef?: string,
		fieldSet?: Set<string>,
	}): Promise<ApiServerClientSingleResult | ApiServerClientListResult> {
		return resourceName
			? await this.getResourceByName({
				resourceDef,
				resourceName,
				scopeDef,
				scopeName,
				expand,
				langDef,
				fieldSet,
			})
			: await this.getResourcesList({
				resourceDef,
				scopeDef,
				scopeName,
				query,
				progressListener,
				expand,
				langDef,
				fieldSet,
			});
	};

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
		const log = logger('ApiServerClient.getResourcesList');
		log.info(`getResourcesList, spec.kind = ${resourceDef.spec.kind}`);
		const version = getLatestServedAPIVersion(resourceDef);
		const result: ApiServerClientListResult = { data: null, error: null };
		try {
			const service = await this.initializeDataService();
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
				query ? { searchParams: { query } } : {},
				50,
				progressListener,
			);
			result.data = response;
		} catch (e: any) {
			log.error('getResourcesList, error: ', e);
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		return result;
	}

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
		const log = logger('ApiServerClient.getResourceByName');
		log.info(
			`getResourceByName, spec.kind = ${resourceDef.spec.kind}, name = ${resourceName}`,
		);
		const version
			= resourceVersion === undefined
				? getLatestServedAPIVersion(resourceDef)
				: resourceVersion;
		const result: ApiServerClientSingleResult = { data: null, error: null };
		try {
			const service = await this.initializeDataService();
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
			log.error('getResourceByName, error: ', e);
			if (e.errors && Array.isArray(e.errors)) {
				result.error = e.errors;
			} else { throw e; }
		}
		return result;
	}

	async getSpecs(version = ApiServerVersions.v1alpha1): Promise<{
		[groupName: string]: {
			resources: Map<string, ResourceDefinition>;
			cli: Map<string, CommandLineInterface>;
		};
	}> {
		const log = logger('ApiServerClient.getSpecs');
		log.info('get specs');
		try {
			const specs: {
				[groupName: string]: {
					resources: Map<string, ResourceDefinition>;
					cli: Map<string, CommandLineInterface>;
				};
			} = {};

			const service = await this.initializeDataService();
			const groups = await service.getWithPagination(`/definitions/${version}/groups`);
			for (const group of groups) {
				let resources: ResourceDefinition[] = [];
				let cli: CommandLineInterface[] = [];
				const cachedGroup = CacheController.get(
					`groups-${group.name}-${version}`,
				);
				let cacheUpdated = false;
				if (
					this.useCache
                    && cachedGroup
                    && cachedGroup.resourceVersion === group.metadata.resourceVersion
				) {
					log.info(`valid ${group.name}/${version} found in cache`);
					resources = cachedGroup.resources;
					cli = cachedGroup.cli;
				} else {
					log.info(
						`no valid ${group.name}/${version} found in cache or cache usage is not set`,
					);
					[ resources, cli ] = await Promise.all([
						service.getWithPagination(
							`/definitions/${version}/groups/${group.name}/resources`,
						),
						service.getWithPagination(
							`/definitions/${version}/groups/${group.name}/commandlines`,
						),
					]);
					CacheController.set(`groups-${group.name}-${version}`, {
						resourceVersion: group.metadata.resourceVersion,
						resources,
						cli,
					});
					cacheUpdated = true;
				}
				specs[group.name] = {
					resources: new Map<string, ResourceDefinition>(),
					cli: new Map<string, CommandLineInterface>(),
				};
				for (const r of resources) {
					specs[group.name].resources.set(r.name, r);
				}
				for (const c of cli) {
					specs[group.name].cli.set(c.name, c);
				}
				if (cacheUpdated) {
					CacheController.writeToFile();
				}
			}
			return specs;
		} catch (e: any) {
			log.error('get specs, error: ', e);
			throw e;
		}
	}

	async bulkCreate(
		resources: Array<GenericResourceWithoutName | GenericResource>,
		sortedDefsMap: Map<string, ResourceDefinition>,
		exitOnError: boolean = false,
	): Promise<ApiServerClientBulkResult> {
		const log = logger('ApiServerClient.bulkCreate');
		log.info('bulk create');
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
				if (res.pending) {
					pendingSubResources.push({
						mainResult: res.data,
						pendingCalls: res.pending,
						withWarning: res.warning ?? false,
					});
				} else if (res.warning) {
					bulkResult.warning?.push(res.data);
				} else {
					bulkResult.success.push(res.data);
				}
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

		for (const p of pendingSubResources) {
			const subResResult = await this.resolveSubResourcesRequests(
				p.mainResult,
				p.pendingCalls,
			);
			if (subResResult.data && !subResResult.error) {
				if (p.withWarning) {
					bulkResult.warning?.push(subResResult.data);
				} else {
					bulkResult.success.push(subResResult.data);
				}
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

	async bulkCreateOrUpdate(
		resources: GenericResourceWithoutName[],
		sortedDefsMap: Map<string, ResourceDefinition>,
		language?: string,
		subResourceName?: string,
	): Promise<Array<ApiServerClientApplyResult>> {
		const log = logger('ApiServerClient.bulkCreateOrUpdate');
		log.info('bulk create or update');
		const sortedDefsArray = Array.from(sortedDefsMap.values());
		const applyResults: Array<ApiServerClientApplyResult> = [];

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

			const getResult: ApiServerClientSingleResult | null = resource.name
				? await this.getResourceByName({
					resourceDef,
					resourceName: resource.name,
					scopeDef,
					scopeName,
					resourceVersion: resource.apiVersion,
				})
				: null;

			let singleResult: ApiServerClientSingleResult;
			const shouldCreate
				= !getResult || (!!getResult?.error && getResult.error[0].status === 404);
			if (shouldCreate) {
				singleResult = await this.createResource({
					resource,
					resourceDef,
					scopeDef,
					scopeName,
					language,
				});
			} else if (getResult!.data) {
				singleResult = await this.updateResource({
					resource: resource as GenericResource,
					resourceDef,
					scopeDef,
					scopeName,
					language,
					subResourceName,
				});
			} else {
				throw new Error(
					`ApiServer error(s): ${JSON.stringify(getResult!.error)}`
				);
			}

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
				applyResult.updatedSubResourceNames = subResResult.updatedSubResourceNames;
				subResResult.error?.forEach((error) =>
					applyResult.error?.push({
						name: resourceName,
						kind: resource.kind,
						error: error,
					}),
				);
			}

			if (!applyResult.error?.length) {
				delete applyResult.error;
			}
		}

		return applyResults;
	}

	async bulkDelete(
		resources: GenericResource[],
		sortedDefsMap: Map<string, ResourceDefinition>,
		wait?: boolean,
		forceDelete?: boolean,
	): Promise<ApiServerClientBulkResult> {
		const log = logger('ApiServerClient.bulkDelete');
		log.info('bulk delete');
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
					bulkResult.success.push(resource);
				}
			} catch (e: any) {
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
			pendingResources = await this.checkForResources(resources, sortedDefsArray);
			const pendingDeletingResource = pendingResources.some((res) => res?.data);
			if (pendingDeletingResource) {
				setTimeout(async () => {
					pendingResources = await this.checkForResources(resources, sortedDefsArray);
				}, WAIT_TIMEOUT);
				const stillPending = pendingResources.some((res) => res?.data);
				if (stillPending) {
					const pendingResNames = pendingResources.map((res) => res?.data?.name);
					bulkResult.success.forEach(
						(res, index) =>
							pendingResNames.includes(res.name)
                            && bulkResult.success.splice(index, 1),
					);
					pendingResources.forEach((res) => {
						if (res?.data) {
							bulkResult.error.push({
								...res.data,
								error: { detail: 'Not deleted yet.' },
							});
						}
					});
				} else { return bulkResult; }
			} else { return bulkResult; }
		}
		return bulkResult;
	}

}
