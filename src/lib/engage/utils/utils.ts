import { writeFileSync } from '../../fs.js';

import { loadAll } from 'js-yaml';

import chalk from 'chalk';
import {
	ApiServerError,
	ApiServerErrorResponse,
	ApiServerVersions,
	CommandLineInterface,
	GenericResource,
	GenericResourceWithoutName,
	LanguageTypes,
	MAX_FILE_SIZE,
	Metadata,
	ParsedScopeParam,
	ResourceDefinition,
	ValidatedDocs,
} from '../types.js';
import { FindDefsByWordResult } from '../results/DefinitionsManager.js';
import { lstatSync, Stats } from 'fs';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { CompositeError } from '../results/compositeerror.js';

export const isWindows = /^win/.test(process.platform);

export const writeToFile = (path: string, data: any): void => {
	try {
		writeFileSync(path, data);
	} catch (e) {
		// if parser is failing, rethrow with our own error
		throw new Error(`Error while writing the yaml file to: ${path}`);
	}
};

/**
 * Checks if the passed item can be converted to a JSON or is a valid JSON object.
 * @param item item to check
 * @returns true if the item can be converted, false otherwise.
 */
export const isValidJson = (item: any) => {
	let parsedItem = typeof item !== 'string' ? JSON.stringify(item) : item;
	try {
		parsedItem = JSON.parse(parsedItem);
	} catch (e) {
		return false;
	}
	return typeof parsedItem === 'object' && item !== null;
};

export function ValueFromKey(
	stringEnum: { [key: string]: string },
	key: string,
): string | undefined {
	for (const k of Object.values(stringEnum)) {
		if (k === stringEnum[key]) {
			return k;
		}
	}
	return undefined;
}

export const createLanguageSubresourceNames = (langCode: string) => {
	const langCodeArr = langCode.split(',');
	const langSubresourceNamesArr = [ 'languages' ];
	const languageTypesArr: (string | undefined)[] = [];
	Object.keys(LanguageTypes).forEach((key) =>
		languageTypesArr.push(ValueFromKey(LanguageTypes, key)),
	);
	langCodeArr.forEach((langCode) => {
		if (langCode.trim() !== '') {
			if (!languageTypesArr.includes(langCode)) {
				console.log(
					chalk.yellow(
						`\n'${langCode}' language code is not supported, hence create/update cannot be performed on 'languages-${langCode}. Allowed language codes: ${LanguageTypes.French} | ${LanguageTypes.German} | ${LanguageTypes.US} | ${LanguageTypes.Portugese}.'`,
					),
				);
			} else {
				langSubresourceNamesArr.push(`languages-${langCode.trim()}`);
			}
		}
	});

	return langSubresourceNamesArr;
};

export const getLatestServedAPIVersion = (
	resourceDef: ResourceDefinition,
): string => {
	const apiVersions = resourceDef.spec.apiVersions;
	if (apiVersions && apiVersions.length > 0) {
		for (const version of apiVersions) {
			if (version.served && !version.deprecated) {
				return version.name;
			}
		}
		return ApiServerVersions.v1alpha1;
	}
	// if the apiVersions are not set on the resource definition, fallback to v1alpha1 version
	return ApiServerVersions.v1alpha1;
};

/**
 * Api-server returns the "resourceVersion" in metadata object as a counter for resource updates.
 * If a user will send this key in the payload it will throw an error so using this helper to sanitizing metadata on
 * the updates.
 * @param doc resource data
 * @returns {GenericResource} resource data without metadata.resourceVersion key
 */
export function sanitizeMetadata(doc: GenericResource): GenericResource;
export function sanitizeMetadata(
	doc: GenericResourceWithoutName,
): GenericResourceWithoutName;
export function sanitizeMetadata(
	doc: GenericResource | GenericResourceWithoutName,
): GenericResource | GenericResourceWithoutName {
	if (doc?.metadata?.resourceVersion) {
		delete doc.metadata.resourceVersion;
	}
	return doc;
}

/**
 * Generate a GenericResource instance from resource definition, resource name, and scope name. Used
 * in some rendering logic for the "delete" command.
 * Note that generated metadata includes only scope info.
 * @param {ResourceDefinition} resourceDef resource definition
 * @param {string} resourceName resource name
 * @param {string} scopeName optional scope name
 * @returns {GenericResource} generic resource representation
 */
export const buildGenericResource = ({
	resourceDef,
	resourceName,
	scopeName,
}: {
	resourceDef: ResourceDefinition;
	resourceName?: string;
	scopeName?: string;
}): GenericResource | GenericResourceWithoutName => {
	if (resourceName) {
		return {
			apiVersion: resourceDef?.apiVersion,
			group: resourceDef?.group,
			title: resourceName,
			name: resourceName,
			kind: resourceDef?.spec.kind,
			attributes: {},
			tags: [],
			metadata:
        resourceDef?.spec?.scope && scopeName
        	? ({
        		scope: {
        			kind: resourceDef?.spec?.scope?.kind,
        			name: scopeName,
        		},
        		// note: forced conversion here only because using generated resources for rendering simple text
        	} as unknown as Metadata)
        	: undefined,
			spec: {},
		};
	} else {
		return {
			apiVersion: resourceDef?.apiVersion,
			group: resourceDef?.group,
			kind: resourceDef?.spec.kind,
			attributes: {},
			tags: [],
			metadata:
        resourceDef?.spec?.scope && scopeName
        	? ({
        		scope: {
        			kind: resourceDef?.spec?.scope?.kind,
        			name: scopeName,
        		},
        		// note: forced conversion here only because using generated resources for rendering simple text
        	} as unknown as Metadata)
        	: undefined,
			spec: {},
		};
	}
};

/**
 * Returns true if error object is of type ApiServerError
 * @param err error object to check
 */
export const isApiServerErrorType = (err: ApiServerError | ApiServerErrorResponse | Error): err is ApiServerError => {
	const cast = err as ApiServerError;
	return !!cast.status && !!cast.title && !!cast.detail;
};

/**
 * Returns true if error object is of type ApiServerErrorResponse
 * @param err error object to check
 */
export const isApiServerErrorResponseType = (
	err: ApiServerError | ApiServerErrorResponse | Error
): err is ApiServerErrorResponse => {
	const cast = err as ApiServerErrorResponse;
	return !!cast.errors && Array.isArray(cast.errors);
};

/**
 * Parse and verify scope param, returns undefined if param is undefined. Throws an error if "Kind" is unknown.
 * @param scopeParam raw scope param value
 * @returns {ParsedScopeParam | undefined}
 */
export const parseScopeParam = (scopeParam?: string): ParsedScopeParam | undefined => {
	if (!scopeParam) {
		return undefined;
	}

	const sp = scopeParam.toString();
	if (sp.indexOf('/') === -1) {
		return { name: scopeParam };
	} else {
		const name = sp.substring(scopeParam.indexOf('/') + 1);
		const kind = sp.substring(0, scopeParam.indexOf('/'));
		if (!name.length || !kind.length) {
			throw Error(
				'invalid scope (-s/--scope) parameter value.'
					+ '\nPlease use "--scope <scope kind>/<scope name>" or "--scope <scope name>" formats.'
			);
		}
		return { name, kind };
	}
};

/**
 * Transforms simple filters(title, attribute, tag) into an RSQL-formatted query string the GET API supports.
 * @param {string} title The title the user wants to filter the resource list by.
 * @param {string} attribute The attribute(key=value) the user wants to filter the resource list by.
 * @param {string} tag The tag the user wants to filter the resource list by.
 * @returns {string} transformedFilter, the RSQL formatted query string
 */
export const transformSimpleFilters = (title?: string, attribute?: string, tag?: string, teamGuid?: string) => {
	const titleFilter = title ? `title=='*${title}*'` : '';
	const attributeKey = attribute && attribute.split('=')[0];
	const attributeValue = attribute && attribute.split('=')[1];
	const attributeFilter = attributeKey && attributeValue ? `attributes.${attributeKey}==${attributeValue}` : '';
	const tagFilter = tag ? `tags==${tag}` : '';
	const teamGuidFilter = teamGuid
		? `owner.id==${teamGuid},(owner.id==null;metadata.scope.owner.id==${teamGuid})`
		: 'owner.id==null';
	const formattedFilter = `${titleFilter && `${titleFilter};`}${attributeFilter && `${attributeFilter};`}${tagFilter && `${tagFilter};`}${teamGuidFilter}`;
	const transformedFilter
		= formattedFilter.charAt(formattedFilter.length - 1) === ';' ? formattedFilter.slice(0, -1) : formattedFilter;
	return transformedFilter;
};

/**
 * Verify parsed scope param:
 * 1. scope kind should be known.
 * 2. scope kind should match at least one in a resource "scoped" definitions ("non-scoped" definition will be ignored).
 * @param allKinds all available kinds.
 * @param defs resource definitions where at least one should match the scope kind if some "scoped" resources are there.
 * @param scopeParam parsed scope param.
 */
export const verifyScopeParam = (
	allKinds: Set<string>,
	defs: {
		resource: ResourceDefinition;
		cli: CommandLineInterface;
		scope?: ResourceDefinition;
	}[],
	scopeParam?: ParsedScopeParam
): void => {
	const allowedScopeKinds = new Set<string>();
	defs.forEach((defs) => !!defs.scope && allowedScopeKinds.add(defs.scope.spec.kind));
	if (scopeParam?.kind) {
		if (!allKinds.has(scopeParam.kind)) {
			throw new Error(
				`unsupported kind value "${scopeParam.kind}" in the "--scope" param.`
					+ `\nCurrently supported values are (case sensitive): ${[ ...allKinds.values() ].join(', ')}`
			);
		}
		if (allowedScopeKinds.size > 0 && !allowedScopeKinds.has(scopeParam.kind)) {
			throw Error(
				`scope kind "${scopeParam.kind}" is invalid.`
					+ `\n"${defs[0].resource.spec.kind}" resource might exist in the following scopes: ${[
						...allowedScopeKinds.values(),
					].join(', ')}`
			);
		}
	}
};

/**
 * Gets the resource field names to be shown when outputting the resource as a table.
 * These names are to be assigned to the api-server HTTP GET request's "fields" query param.
 * @param def The resource definition providing the columns to be shown in the outputed table.
 * @returns Returns a set set of field names.
 */
export function getFieldSetFromDefinitionColumns(def: FindDefsByWordResult): Set<string> {
	const fieldSet = new Set<string>();
	def.cli?.spec?.columns?.forEach(column => {
		let fieldName = column.jsonPath;
		if (fieldName.startsWith('.')) {
			fieldName = fieldName.substring(1);
		}
		fieldSet.add(fieldName);
	});
	return fieldSet;
}

export const verifyFile = (specFilePath: string): Error | void => {
	let stats: Stats;
	let fileExtension: string;
	try {
		stats = lstatSync(specFilePath);
		fileExtension = extname(specFilePath);
	} catch (e) {
		throw new Error(`Couldn't find the definition file: ${specFilePath}`);
	}

	if (!stats.isFile()) {
		throw new Error(`Couldn't load the definition file: ${specFilePath}`);
	} else if (stats.size >= MAX_FILE_SIZE) {
		throw new Error('File size too large');
	} else if (fileExtension !== '.yaml' && fileExtension !== '.yml' && fileExtension !== '.json') {
		throw new Error('File extension is invalid, please provide \'.yaml\' or \'.yml\' or \'.json\' file');
	}
};

/**
 * Loads and parse file from path, accepts JSON and YAML files. Also completing validation on "kind" values.
 * @param specFilePath file path
 * @param allowedKinds array of allowed "kind" values
 */
export const loadAndVerifySpecs = async (
	specFilePath: string,
	allowedKinds: Set<string>,
	skipKindCheck?: boolean
): Promise<ValidatedDocs> => {
	// Load the given JSON or YAML file.
	let docs = [];
	let isMissingName = false;
	try {
		docs = loadAll(await readFile(specFilePath, 'utf8'));
	} catch (e: any) {
		throw new Error(
			e.reason && e.reason.includes('null byte')
				? 'File encoding is invalid, please make sure it is using UTF-8'
				: 'File content is invalid.'
		);
	}

	// if user pass an array of json objects, docs const will have nested array, workaround for this:
	if (extname(specFilePath) === '.json' && docs.length === 1 && Array.isArray(docs[0])) {
		docs = docs[0];
	}

	// Do not continue if given an empty file.
	if (!docs.length) {
		throw new Error('File is empty.');
	}

	// Validate all entries in the file.
	const errors: Error[] = [];
	const createErrorPrefix = (index: number, kind?: string, name?: string) => {
		return `Entry ${index + 1}, "${kind}/${name || 'Unknown name'}"`;
	};
	for (let index = 0; index < docs.length; index++) {
		// Verify document is defined/valid.
		const doc = docs[index];
		if (typeof doc !== 'object' || !doc) {
			errors.push(new Error(`${createErrorPrefix(index)}: Entry format is invalid.`));
			continue;
		}

		// Set a flag if at least 1 name is messing in file.
		if (!doc.name) {
			isMissingName = true;
		}

		if (!skipKindCheck) {
			// Validate resource kind.
			if (!doc.kind) {
				errors.push(
					Error(
						`${createErrorPrefix(index, doc.kind, doc.name)}: The "kind" field is missing.`
							+ `\nCurrently supported values are (case sensitive): ${[ ...allowedKinds.values() ].join(', ')}`
					)
				);
			} else if (!allowedKinds.has(doc.kind)) {
				errors.push(
					new Error(
						`${createErrorPrefix(index, doc.kind, doc.name)}: Kind "${doc.kind}" is unsupported.`
							+ `\nCurrently supported values are (case sensitive): ${[ ...allowedKinds.values() ].join(', ')}`
					)
				);
			}
		}

		// TODO: Validate "metadata.scope.kind" if available. Requires DefinitionManager.getSortedKindsMap() result.
	}
	if (errors.length > 0) {
		throw new CompositeError(errors);
	}

	// File's contents appears to be valid. Return loaded info.
	return <ValidatedDocs>{ docs, isMissingName };
};

export function KeyValueMapToNameValueArray(m: Map<string, string>): any[] | undefined {
	const array: any[] = [];
	m.forEach((value, key) => {
		array.push({
			name: key,
			value: value,
		});
	});
	if (array.length === 0) {
		return undefined;
	}
	return array;
}

/**
 * Wait for the given milliseconds
 * @param {number} ms The given time to wait
 * @returns {Promise} A fulfilled promise after the given time has passed
 */
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch resource definition of given kind and scope kind if exists
 * @param {ResourceDefinition[]} sortedDefsArray The given time to wait
 * @param {Kind} kind The kind of the resource
 * @param {Kind} scopeKind The scope kind of the resource
 */
export const getResourceDefinition = async (
	sortedDefsArray: ResourceDefinition[],
	kind: string,
	scopeKind?: string
): Promise<ResourceDefinition | undefined> => {
	const resourceDefinition = sortedDefsArray.find((def) => {
		return scopeKind ? def.spec.kind === kind && def.spec.scope?.kind === scopeKind : def.spec.kind === kind;
	});
	return resourceDefinition;
};

export const helmImageSecretInfo = async (namespace: string): Promise<void> => {
	let dockerSecretCmd = `kubectl create secret docker-registry <image-pull-secret-name> --namespace ${namespace} \\`;
	dockerSecretCmd += '\n  --docker-server=docker.repository.axway.com \\';
	dockerSecretCmd += '\n  --docker-username=<client_id> \\';
	dockerSecretCmd += '\n  --docker-password=<client_secret>';
	console.log(
		'\nTo setup docker image secret for the pulling the agent docker images, run the following command:',
		chalk.cyan(`\n${dockerSecretCmd}`),
		chalk.cyan('\n'),
		chalk.white('\n* client_id - service account id for your Amplify Platform organization'),
		chalk.white('\n* client_secret - service account secret for your Amplify Platform organization'),
		chalk.white('\n* image-pull-secret - Kubernetes secret name with docker config to pull images'),
	);
};

export interface AgentHelmInfo {
	helmReleaseName: string,
	helmChartName: string,
	overrideFileName: string,
	imageSecretOverrides: string
}

export const helmInstallInfo = async (
	agentType: string,
	namespace: string,
	agentInfo: Set<AgentHelmInfo>
): Promise<void> => {
	let helmInstallCmd = '';
	agentInfo.forEach(function (entry) {
		helmInstallCmd += `helm upgrade --install --namespace ${namespace} ${entry.helmReleaseName} ${entry.helmChartName} \\`;
		helmInstallCmd += `\n  -f ${entry.overrideFileName} \\`;
		helmInstallCmd += `\n  ${entry.imageSecretOverrides}\n`;
	});

	console.log(
		`\nTo complete the ${agentType} Agent installation run the following commands:`,
		chalk.cyan('\nhelm repo add axway https://helm.repository.axway.com --username=<client_id> --password=<client_secret>'),
		chalk.cyan(`\nhelm repo update\n${helmInstallCmd}`),
		chalk.white('\n* client_id - service account id for your Amplify Platform organization'),
		chalk.white('\n* client_secret - service account secret for your Amplify Platform organization'),
		chalk.white('\n* image-pull-secret - Kubernetes secret name with docker config to pull images'),
	);
};

export function getAuthConfigEnvSpecifier(env) {
	return !env || env === 'prod' ? 'auth' : `auth.environment.${env}`;
}

