import logger from '../../logger.js';
import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../results/DefinitionsManager.js';
import { ApiServerClientBulkResult, ApiServerClientListResult, GenericResource, GenericResourceWithoutName, Kind, ProductizeCommandParams, ProductizeCommandResult, ResourceDefinition } from '../types.js';
import { buildGenericResource, getLatestServedAPIVersion, getResourceDefinition, loadAndVerifySpecs, verifyFile, wait } from '../utils/utils.js';

const log = logger('engage:productize-service');

export async function productizeResources(params: ProductizeCommandParams): Promise<ProductizeCommandResult> {
	const { account, filePath, region, useCache, transferOwnership } = params;

	verifyFile(filePath);

	const client = new ApiServerClient({ account, region, useCache, baseUrl: params.baseUrl });
	const defsManager = await new DefinitionsManager(client).init();
	let results: Map<string, ApiServerClientBulkResult> = new Map();

	await defsManager.init();
	log('loading and verifying specs');
	const allowedKind = new Set<string>().add(Kind.APIService);
	const { docs } = await loadAndVerifySpecs(filePath, allowedKind, true);
	const sortedKindsMap = defsManager.getSortedKindsMap();
	results = await bulkProductizeAPIServices(docs as GenericResource[], sortedKindsMap, transferOwnership, client);
	return { results };
}

/**
	 * Bulk Productization of API services.
	 * @param resources array of API services to be productized
	 */
async function bulkProductizeAPIServices(
	resources: Array<GenericResource>,
	sortedDefsMap: Map<string, ResourceDefinition>,
	transferOwnership: boolean,
	apiServerClient: ApiServerClient
): Promise<Map<string, ApiServerClientBulkResult>> {
	const sortedDefsArray = Array.from(sortedDefsMap.values());
	const bulkResultMap: Map<string, ApiServerClientBulkResult> = new Map();
	for (const resource of resources) {
		const bulkResult: ApiServerClientBulkResult = { success: [], error: [], warning: [] };
		if (!resource?.spec?.apiService?.name) {
			const errorMessage = `Found an entry without a logical name for "kind/${Kind.APIService}".`;
			bulkResult.error.push({
				name: resource?.spec?.apiService?.name,
				kind: Kind.APIService,
				error: new Error(errorMessage),
			});
			bulkResultMap.set(resource.spec?.apiService?.name, bulkResult);
			continue;
		}
		if (!resource.metadata?.scope?.name) {
			const errorMessage = `Found an API Service without a scope name for "kind/${Kind.Environment}".`;
			bulkResult.error.push({
				name: resource?.spec?.apiService?.name,
				kind: Kind.Environment,
				error: new Error(errorMessage),
			});
			bulkResultMap.set(resource.spec?.apiService?.name, bulkResult);
			continue;
		}
		const apiSvcResourceDef = (await getResourceDefinition(
			sortedDefsArray,
			Kind.APIService,
			Kind.Environment
		)) as ResourceDefinition;
		const envResourceDef = (await getResourceDefinition(sortedDefsArray, Kind.Environment)) as ResourceDefinition;
		const assetResourceDef = (await getResourceDefinition(sortedDefsArray, Kind.Asset)) as ResourceDefinition;
		const productResourceDef = (await getResourceDefinition(sortedDefsArray, Kind.Product)) as ResourceDefinition;

		const apiSvc = await apiServerClient.getResourceByName({
			resourceDef: apiSvcResourceDef,
			resourceName: resource?.spec?.apiService?.name,
			scopeDef: envResourceDef,
			scopeName: resource.metadata?.scope.name,
		});
		if (apiSvc.data && !apiSvc.error) {
			const apiSvcInstanceResDef = (await getResourceDefinition(
				sortedDefsArray,
				Kind.APIServiceInstance,
				Kind.Environment
			)) as ResourceDefinition;
			const query = 'metadata.references.id==' + apiSvc.data?.metadata?.id;
			const apiServiceInstances = await apiServerClient.getResourcesList({
				resourceDef: apiSvcInstanceResDef,
				scopeDef: envResourceDef,
				scopeName: resource.metadata?.scope.name,
				query: query,
			});
				// Donot continue if there are no api service instances
			if (
				(apiServiceInstances.error && apiServiceInstances.error?.length > 0)
					|| !apiServiceInstances.data
					|| apiServiceInstances.data?.length === 0
			) {
				bulkResult.error.push({
					name: resource?.spec?.apiService?.name,
					kind: resource.kind,
					error: new Error('Unable to find APIServiceInstances for API Service: ' + resource?.spec?.apiService?.name),
				});
				bulkResultMap.set(resource.spec?.apiService?.name, bulkResult);
				continue;
			}
			const assetResourcesResult: ApiServerClientBulkResult
				= await createAssetResourcesForAPIServiceProductization(
					apiSvc.data,
					sortedDefsMap,
					apiServiceInstances,
					transferOwnership,
					apiServerClient
				);
			if (assetResourcesResult.error.length > 0) {
				// if there is an error at any stage while productizing an api service,
				// clean up the resources created until that stage to avoid duplicate resources hanging around
				const asset = assetResourcesResult.warning?.find((result) => result.kind === Kind.Asset);
				if (asset !== undefined) {
					await cleanupResourcesOnFailure(asset, assetResourceDef, apiServerClient);
				}
				bulkResult.error.push(...assetResourcesResult.error);
				bulkResultMap.set(resource.spec?.apiService?.name, bulkResult);
				continue;
			}
			const assetName = assetResourcesResult.warning?.find((res) => res.kind === Kind.Asset)?.name as string;
			const assetReleaseTagName = assetResourcesResult.warning?.find((res) => res.kind === Kind.ReleaseTag)
				?.name as string;
			if (assetResourcesResult.warning) {
				bulkResult.warning?.push(...assetResourcesResult.warning);
			}
			// check if asset release tag is created, then only proceed with creation of product resources
			const releaseTagFound = await checkForAssetReleaseTag(sortedDefsArray, assetReleaseTagName, assetName, apiServerClient);
			if (releaseTagFound) {
				const active = await waitForAssetActivation(assetResourceDef, assetName, apiServerClient);
				if (active) {
					const productResourcesResult: ApiServerClientBulkResult
						= await createProductResourcesForAPIServiceProductization(
							apiSvc.data as GenericResource,
							sortedDefsMap,
							transferOwnership,
							assetName,
							apiServerClient
						);
					if (productResourcesResult.error.length > 0) {
						const asset = assetResourcesResult.warning?.find((r) => r.kind === Kind.Asset);
						const product = productResourcesResult.warning?.find((r) => r.kind === Kind.Product);
						// eslint-disable-next-line max-depth
						if (asset !== undefined) {
							await cleanupResourcesOnFailure(asset, assetResourceDef, apiServerClient);
						}
						// eslint-disable-next-line max-depth
						if (product !== undefined) {
							await cleanupResourcesOnFailure(product, productResourceDef, apiServerClient);
						}
						bulkResult.error.push(...productResourcesResult.error);
					}
					if (productResourcesResult.warning) {
						bulkResult.warning?.push(...productResourcesResult.warning);
					}
				} else {
					const asset = assetResourcesResult.warning?.find((r) => r.kind === Kind.Asset);
					if (asset) {
						await cleanupResourcesOnFailure(asset, assetResourceDef, apiServerClient);
					}
					bulkResult.error.push({
						name: resource?.spec?.apiService?.name,
						kind: Kind.Asset,
						error: new Error('Asset status not set to active while productizing api service'),
					});
				}
			} else {
				const asset = assetResourcesResult.warning?.find((r) => r.kind === Kind.Asset);
				if (asset) {
					await cleanupResourcesOnFailure(asset, assetResourceDef, apiServerClient);
				}
				bulkResult.error.push({
					name: resource?.spec?.apiService?.name,
					kind: Kind.ReleaseTag,
					error: new Error('Unable to get asset release status while productizing api service'),
				});
			}
		} else {
			bulkResult.error.push({
				name: resource?.spec?.apiService?.name,
				kind: resource.kind,
				error: new Error(
					'Unable to find API Service with name: '
							+ resource?.spec?.apiService?.name
							+ ' in Environment scope: '
							+ resource.metadata?.scope.name
				),
			});
		}
		bulkResultMap.set(resource.spec?.apiService?.name, bulkResult);
	}
	return bulkResultMap;
}

/**
	 * Create asset resources needed for productizing API services.
	 * @param apiService the apiService resource that needs to be productized
	 * @param sortedDefsMap sorted resource definition map
	 * @param apiServiceInstances api service instances referenced by the api service
	 * @param transferOwnership transfer ownership from api service to asset
	 * @param apiServerClient the API server client instance
	 */
async function createAssetResourcesForAPIServiceProductization(
	apiService: GenericResource,
	sortedDefsMap: Map<string, ResourceDefinition>,
	apiServiceInstances: ApiServerClientListResult,
	transferOwnership: boolean,
	apiServerClient: ApiServerClient,
): Promise<ApiServerClientBulkResult> {
	const bulkResult: ApiServerClientBulkResult = { success: [], error: [], warning: [] };
	const resources: Array<GenericResource | GenericResourceWithoutName> = [];
	const resourceName = apiService.name;
	const sortedDefsArray = Array.from(sortedDefsMap.values());
	// 1. Asset.
	const assetResourceDef = (await getResourceDefinition(sortedDefsArray, Kind.Asset)) as ResourceDefinition;
	const assetResource = buildGenericResource({ resourceDef: assetResourceDef });
	// carry over the title of API Service to the asset title
	assetResource.title = apiService?.title;
	// transfer the ownership from api service if asked to
	if (transferOwnership && apiService?.owner) {
		assetResource.owner = { type: 'team', id: apiService?.owner?.id };
	}
	// 1.1 set autorelease
	assetResource.spec = {
		type: 'API',
		autoRelease: {
			releaseType: 'patch',
			requiresInitialActivation: true,
		},
	};
	// 1.2 add asset icon, if one exists
	if (apiService?.spec?.icon?.data) {
		assetResource.icon = `data:image/png;base64,${apiService?.spec?.icon?.data}`;
	}
	// 1.3 add asset access approval
	assetResource.access = { approval: 'automatic' };
	const assetResources: Array<GenericResource | GenericResourceWithoutName> = [];
	assetResources.push(assetResource);
	const assetResponse = await apiServerClient.bulkCreate(assetResources, sortedDefsMap, true);

	if (
		assetResponse
			&& assetResponse.warning
			&& assetResponse.warning?.length > 0
			&& assetResponse.error.length === 0
	) {
		bulkResult.warning?.push(...assetResponse.warning);
		const assetName = assetResponse.warning?.find((res) => res.kind === Kind.Asset)?.name;
		// 1.4 Asset Mapping
		const assetMappingResourceDef = (await getResourceDefinition(
			sortedDefsArray,
			Kind.AssetMapping,
			Kind.Asset
		)) as ResourceDefinition;
		const assetMappingResource = buildGenericResource({
			resourceDef: assetMappingResourceDef,
			scopeName: assetName,
		}) as GenericResourceWithoutName;
			// 1.5 set inputs
		apiServiceInstances.data!.forEach((instance) => {
			assetMappingResource.spec = {
				inputs: {
					apiService: `management/${apiService.metadata?.scope?.name}/${resourceName}`,
					apiServiceInstance: `management/${instance.metadata?.scope!.name}/${instance.name}`,
				},
			};
		});
		resources.push(assetMappingResource);
		// 1.6 Asset Release Tag
		const assetReleaseResourceDef = (await getResourceDefinition(
			sortedDefsArray,
			Kind.ReleaseTag,
			Kind.Asset
		)) as ResourceDefinition;
		const assetReleaseResource = buildGenericResource({
			resourceDef: assetReleaseResourceDef,
			scopeName: assetName,
		}) as GenericResourceWithoutName;
		assetReleaseResource.spec = {
			releaseType: 'major',
		};
		resources.push(assetReleaseResource);
		const assetResourcesResult: ApiServerClientBulkResult = await apiServerClient.bulkCreate(
			resources,
			sortedDefsMap,
			true
		);
		if (
			assetResourcesResult
				&& assetResourcesResult.warning
				&& assetResourcesResult.warning.length > 0
				&& assetResourcesResult.error.length === 0
		) {
			bulkResult.warning?.push(...assetResourcesResult.warning);
		} else {
			bulkResult.error.push(...assetResourcesResult.error);
		}
	} else {
		bulkResult.error.push(...assetResponse.error);
	}

	return bulkResult;
}

/**
	 * Create product resources needed for productizing API services.
	 * @param apiService the apiService resource that needs to be productized
	 * @param sortedDefsMap sorted resource definition map
	 * @param transferOwnership transfer ownership from api service to product
	 */
async function createProductResourcesForAPIServiceProductization(
	apiService: GenericResource,
	sortedDefsMap: Map<string, ResourceDefinition>,
	transferOwnership: boolean,
	assetName: string,
	apiServerClient: ApiServerClient,
): Promise<ApiServerClientBulkResult> {
	const bulkResult: ApiServerClientBulkResult = { success: [], error: [], warning: [] };
	const sortedDefsArray = Array.from(sortedDefsMap.values());
	// 1. Product
	const productResourceDef = (await getResourceDefinition(sortedDefsArray, Kind.Product)) as ResourceDefinition;
	const productResource = buildGenericResource({ resourceDef: productResourceDef });
	// carry over the title of API Service to the product title
	productResource.title = apiService?.title;
	productResource.spec = {
		autoRelease: {
			releaseType: 'patch',
			requiresInitialActivation: true,
		},
		assets: [ { name: assetName } ],
	};
	// transfer the ownership from api service if asked to
	if (transferOwnership && apiService?.owner) {
		productResource.owner = { type: 'team', id: apiService?.owner?.id };
	}
	// 1.1 add product icon, if one exists
	if (apiService?.spec?.icon?.data) {
		productResource.icon = `data:image/png;base64,${apiService?.spec?.icon?.data}`;
	}
	const productResources: Array<GenericResource | GenericResourceWithoutName> = [];
	productResources.push(productResource);
	const productResponse = await apiServerClient.bulkCreate(productResources, sortedDefsMap, true);
	if (
		productResponse
			&& productResponse.warning
			&& productResponse.warning.length > 0
			&& productResponse.error.length === 0
	) {

		const productName = productResponse.warning?.find((res) => res.kind === Kind.Product)?.name;
		bulkResult.warning?.push(...productResponse.warning);
		// 1.2 Product Release Tag
		const productReleaseResourceDef = (await getResourceDefinition(
			sortedDefsArray,
			Kind.ReleaseTag,
			Kind.Product
		)) as ResourceDefinition;
		const productReleaseResource = buildGenericResource({
			resourceDef: productReleaseResourceDef,
			scopeName: productName,
		}) as GenericResourceWithoutName;
		productReleaseResource.spec = {
			releaseType: 'major',
		};
		const productResources: Array<GenericResource | GenericResourceWithoutName> = [];
		productResources.push(productReleaseResource);
		const productReleaseResult = await apiServerClient.bulkCreate(productResources, sortedDefsMap, true);
		if (
			productReleaseResult
				&& productReleaseResult.warning
				&& productReleaseResult.warning.length > 0
				&& productReleaseResult.error.length === 0
		) {
			bulkResult.warning?.push(...productReleaseResult.warning);
		} else {
			bulkResult.error.push(...productReleaseResult.error);
		}
	} else {
		bulkResult.error.push(...productResponse.error);
	}
	return bulkResult;
}

/**
	 * Verify if an asset state has been set to active
	 * @param assetResourceDef asset resource definition
	 * @param assetName name of the asset
	 */
async function waitForAssetActivation(assetResourceDef: ResourceDefinition, assetName: string, apiServerClient: ApiServerClient): Promise<boolean> {
	const endTime = new Date();
	endTime.setTime(endTime.getTime() + 5000);
	const query = `name==${assetName};state==active`;
	while (endTime > new Date()) {
		const response = await apiServerClient.getResourceCount({
			resourceDef: assetResourceDef,
			query: query,
		});
		if ((parseInt(response) ?? 0) > 0) {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	return false;
}

/**
	 * Verify if an asset release tag has been created
	 * @param sortedDefsArray array of sorted defs
	 * @param releaseTag name of the asset release tag
	 * @param assetName name of the asset where the release tag is scoped under
	 * @param totalAttempts max number of attempts to successfully verify
	 * @param delay time in ms to wait to restart a new attempt
	 * @param retried number of retries to make
	 */
async function checkForAssetReleaseTag(
	sortedDefsArray: ResourceDefinition[],
	releaseTag: string,
	assetName: string,
	apiServerClient: ApiServerClient,
	totalAttempts = 8,
	delay = 100,
	retries = 0
): Promise<boolean> {
	const assetReleaseResourceDef = (await getResourceDefinition(
		sortedDefsArray,
		Kind.ReleaseTag,
		Kind.Asset
	)) as ResourceDefinition;
	const assetResourceDef = (await getResourceDefinition(sortedDefsArray, Kind.Asset)) as ResourceDefinition;
	await wait(delay);
	const assetReleaseTag = await apiServerClient.getResourceByName({
		resourceDef: assetReleaseResourceDef,
		resourceName: releaseTag,
		scopeDef: assetResourceDef,
		scopeName: assetName,
	});

	if (
		assetReleaseTag
			&& assetReleaseTag.data
			&& !assetReleaseTag.error
			&& assetReleaseTag.data.status?.level === 'Success'
	) {
		return true;
	} else if (retries < totalAttempts) {
		// Try again after delay.
		return await checkForAssetReleaseTag(
			sortedDefsArray,
			releaseTag,
			assetName,
			apiServerClient,
			totalAttempts,
			2 ** retries * 100,
			retries + 1,
		);
	} else {
		// Ran out of attempts
		return false;
	}
}

/**
	 * Cleanup Asset/Product resources on Productization Failures
	 * @param resource the asset/product to be cleaned up
	 * @param resourceDef corresponding resource definition
	 */
async function cleanupResourcesOnFailure(resource: GenericResource, resourceDef: ResourceDefinition, apiServerClient: ApiServerClient): Promise<void> {
	// update the state of asset/product before deleting it and all the resources scoped under it
	resource.state = 'archived';
	const version = resource.apiVersion === undefined ? getLatestServedAPIVersion(resourceDef) : resource.apiVersion;
	const subResourceReq = await apiServerClient.generateSubResourcesRequests({
		resource: resource,
		resourceName: resource.name,
		resourceDef: resourceDef,
		subResourceName: 'state',
		version: version,
	});
	const subResourceResult = await apiServerClient.resolveSubResourcesRequests(resource, subResourceReq);

	if (subResourceResult.data && !subResourceResult.error) {
		// delete the asset/product and all resources scoped under it if any
		await apiServerClient.deleteResourceByName({
			resourceDef: resourceDef,
			resourceName: resource.name,
			wait: true,
			forceDelete: true,
		});
	}
}
