/* eslint-disable @typescript-eslint/no-unused-expressions */
import fsExtra from 'fs-extra';
import { ApiServerClient } from '../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../results/DefinitionsManager.js';
import { kubectl } from '../../utils/agents/kubectl.js';
import { AgentResourceKind, AgentTypes, DataPlaneNames, DosaAccount, GenericResource, IDPAuthConfiguration, IDPConfiguration } from '../../types.js';
import logger from '../../../logger.js';
import { PlatformClient, PlatformServiceAccountRole } from '../../clients-external/platformclient.js';
import chalk from 'chalk';
import { createKeyPair } from '../bash-commands.js';

const log = logger('lib: engage: utils: agents: creators');

export const createBackUpConfigs = async (configFiles: string[]): Promise<boolean> => {
	let fileExist = false;
	const dateTimeStamp = new Date()
		.toISOString()
		.slice(0, 10)
		.concat(' ')
		.concat(new Date().toLocaleTimeString('it-IT'))
		.replace(/:\s*/g, '.');
	const backupDate = `${dateTimeStamp}-`;

	for (const configFile of configFiles) {
		if (fsExtra.existsSync(configFile)) {
			fileExist = true;
			const backupFile = backupDate + configFile;

			await fsExtra
				.copyFile(configFile, backupFile)
				// eslint-disable-next-line promise/always-return
				.then(() => {
					console.log(`Created backup file ${backupFile}`);
				})
				.catch((err) => {
					console.error(err);
				});
		}
	}

	return fileExist;
};

export const createDosaAndCerts = async (client: PlatformClient, name: string): Promise<DosaAccount> => {
	console.log('Creating a new service account.');
	const { publicKey, privateKey } = await createKeyPair();
	const publicCert = fsExtra.readFileSync(publicKey).toString();
	const account = await client.createServiceAccount({
		name: name,
		desc: name,
		publicKey: publicCert,
		roles: [ PlatformServiceAccountRole.ApiCentralAdmin ],
	});
	console.log(
		chalk.green(
			`New service account "${account.name}" with clientId "${account.client_id}" has been successfully created.`
		)
	);
	console.log(
		chalk.green(`The private key has been placed at ${privateKey}\nThe public key has been placed at ${publicKey}`)
	);
	return new DosaAccount(account.client_id, publicKey, privateKey);
};

export const updateSubResourceType = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	name: string,
	resourceType: string,
	resourceShortName: string,
	scopeName: string = '',
	subResources: any = {},
) => {
	const defs = defsManager.findDefsByWord(resourceShortName);
	if (!defs) {
		throw Error(`the server doesn't have a resource type "${resourceType}"`);
	}

	const knownSubResourcesNames = defs[0].resource.spec.subResources?.names ?? [];
	for (const [ key, value ] of Object.entries(subResources)) {
		if (knownSubResourcesNames.includes(key)) {
			console.log(`Updating subresource ${key} on ${resourceType}`);

			const resource = {
				name,
			};
			Object.assign(resource, { [key]: value });
			await client.updateSubResource({
				resourceDef: defs[0].resource,
				resource: resource as GenericResource,
				subResourceName: key,
				scopeDef: defs[0].scope ? defs[0].scope : undefined,
				scopeName: defs[0].scope ? scopeName || name : undefined,
			});
		}
	}
};

export const createByResourceType = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	name: string,
	resourceType: string,
	resourceShortName: string,
	spec: any = {},
	scopeName: string = '',
	subResources: any = {},
): Promise<string> => {
	console.log(`Creating a new ${resourceType}`);
	// NOTE: only a first found set is used
	const defs = defsManager.findDefsByWord(resourceShortName);
	if (!defs) {
		throw Error(`the server doesn't have a resource type "${resourceType}"`);
	}

	const resource = {
		name,
		spec,
	};

	const knownSubResourcesNames = defs[0].resource.spec.subResources?.names ?? [];
	for (const [ key, value ] of Object.entries(subResources)) {
		if (knownSubResourcesNames.includes(key)) {
			Object.assign(resource, { [key]: value });
		}
	}

	const withSubRes = (subResources !== null);
	const result = await client.createResource({
		resource,
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: defs[0].scope ? scopeName || name : undefined,
		withSubResources: withSubRes
	});

	if (!result.data) {
		const errMsg = `cannot create a new ${resourceType.toLowerCase()}`;
		if (result.error?.length) {
			throw Error(`${errMsg}: ${result.error[0].detail}.`);
		} else {
			throw Error(`${errMsg}.`);
		}
	} else {
		console.log(`New ${resourceType.toLowerCase()} "${result.data.name}" has been successfully created.`);
	}
	return result.data.name;
};

interface DataplaneSubresource {
	name: string;
	frequency: string | undefined;
	queueDiscovery: boolean | undefined;
	queueTrafficCollection: boolean | undefined;
}

export const createNewAgentResource = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	envName: string,
	dataPlaneType: string,
	agentResource: AgentResourceKind,
	agentType: AgentTypes,
	owningTeam?: string,
	agentName?: string,
	dataPlaneName?: string,
	frequency?: string,
	queue? : boolean,
	config? : any,
	filterDA? : string
): Promise<string> => {
	console.log(`Creating a new ${agentResource}, with data plane type: ${dataPlaneType}.`);
	// NOTE: only a first found set is used
	const defs = defsManager.findDefsByWord(agentType);

	if (!defs) {
		throw Error(`the server doesn't have a resource type "${agentType}"`);
	}

	// create the dataplane object
	let withSubResources = false;
	const dataplane = {} as DataplaneSubresource;
	if (dataPlaneName) {
		dataplane.name = dataPlaneName;
		withSubResources = true;
	}
	frequency ? dataplane.frequency = frequency : null;
	queue ? agentResource === AgentResourceKind.da ? dataplane.queueDiscovery = queue : dataplane.queueTrafficCollection = queue : null;
	config ? null : config = { owningTeam: owningTeam, filter: dataPlaneType as DataPlaneNames === DataPlaneNames.AWS || DataPlaneNames.AZURE ? filterDA?.trim() : '' };

	const result = await client.createResource({
		resource: {
			title: agentName,
			spec: {
				dataplaneType: dataPlaneType,
				config: config,
			},
			dataplane: dataplane,
		},
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: envName,
		withSubResources: withSubResources,
	});

	if (!result.data) {
		const errMsg = 'cannot create a new agent';
		if (result.error?.length) {
			throw Error(`${errMsg}: ${result.error[0].detail}.`);
		} else {
			throw Error(`${errMsg}.`);
		}
	} else {
		console.log(
			`New agent of type "${defs[0].resource.name}" named "${result.data.name}" has been successfully created.`
		);
	}
	return result.data.name;
};

/**
 * @description Helper func to create a new DataPlane resource
 * @param client API Service Client
 * @param defsManager Definition Manager
 * @param envName Environment Name
 * @param dataPlaneType DataPlane Type
 */
export const createNewDataPlaneResource = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	envName: string,
	dataPlaneType: string,
	config: any,
): Promise<GenericResource> => {
	console.log(`Creating a new Dataplane resource, with type: ${dataPlaneType}.`);
	// NOTE: only a first found set is used
	const defs = defsManager.findDefsByWord('dp');
	if (!defs) {
		throw Error('the server doesn\'t have a resource type "Dataplane"');
	}
	const result = await client.createResource({
		resource: {
			title: dataPlaneType + ' Dataplane',
			spec: {
				type: dataPlaneType,
				config: config,
			},
		},
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: envName,
	});

	if (!result.data) {
		const errMsg = 'cannot create a new dataplane';
		if (result.error?.length) {
			throw Error(`${errMsg}: ${result.error[0].detail}.`);
		} else {
			throw Error(`${errMsg}.`);
		}
	} else {
		console.log(
			`New dataplane of type "${defs[0].resource.name}" named "${result.data.name}" has been successfully created.`
		);
	}
	return result.data;
};

/**
 * @description Helper func to create a new DataPlane resource
 * @param client API Service Client
 * @param defsManager Definition Manager
 * @param envName Environment Name
 * @param dataPlaneName DataPlane Name
 * @param accessData Encrypted Access Data
 */
export const createNewDataPlaneSecretResource = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	envName: string,
	dataPlaneType: string,
	dataPlaneName: string,
	accessData: string,
): Promise<GenericResource|undefined> => {
	console.log('Creating a new DataplaneSecret resource.');
	// NOTE: only a first found set is used
	const defs = defsManager.findDefsByWord('dps');

	if (!defs) {
		throw Error('the server doesn\'t have a resource type "DataplaneSecret"');
	}
	const result = await client.createResource({
		resource: {
			title: dataPlaneType + ' Dataplane Secret',
			spec: {
				dataplane: dataPlaneName,
				data: accessData,
			},
		},
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: envName,
	});

	log(result);
	if (!result.data) {
		const errMsg = 'cannot create a new agent';
		if (result.error?.length) {
			throw Error(`${errMsg}: ${result.error[0].detail}.`);
		} else {
			throw Error(`${errMsg}.`);
		}
	} else {
		console.log(
			`New secret of type "${defs[0].resource.name}" named "${result.data.name}" has been successfully created.`
		);
	}
	return result.data;
};

/**
 * @description Helper func to create a new Identity Provider resource
 * @param client API Service Client
 * @param defsManager Definition Manager
 * @param idpConfig IDP Configuration from inputs
 */
export const createNewIDPResource = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	idpConfig: IDPConfiguration,
): Promise<GenericResource|undefined> => {
	console.log('Creating a new Identity Provider resource.');
	// NOTE: only a first found set is used
	const defs = defsManager.findDefsByWord('idp');

	if (!defs) {
		throw Error('the server doesn\'t have a resource type Identity Provider');
	}
	const result = await client.createResource({
		resource: {
			title: idpConfig.title,
			spec: idpConfig.getSpec(),
		},
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
	});

	log(result);
	if (!result.data) {
		const errMsg = 'cannot create a new agent';
		if (result.error?.length) {
			throw Error(`${errMsg}: ${result.error[0].detail}.`);
		} else {
			throw Error(`${errMsg}.`);
		}
	} else {
		console.log(
			`New Identity Provider of type "${defs[0].resource.name}" named "${result.data.name}" has been successfully created.`
		);
	}
	return result.data;
};

/**
 * @description Helper func to create a new Identity Provider Secret resource
 * @param client API Service Client
 * @param defsManager Definition Manager
 * @param idpAuthConfig IDP Auth Configuration from inputs
 * @param idpResource IDP Configuration received after creating the IDP from inputs
 */
export const createNewIDPSecretResource = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	idpAuthConfig: IDPAuthConfiguration,
	idpResource: GenericResource,
): Promise<GenericResource|undefined> => {
	console.log('Creating a new Identity Provider Secret resource.');
	// NOTE: only a first found set is used
	const defs = defsManager.findDefsByWord('idpsec');
	if (!defs) {
		throw Error('the server doesn\'t have a resource type Identity Provider Secret');
	}

	const result = await client.createResource({
		resource: {
			title: idpResource.title + ' IDPSecret',
			spec: idpAuthConfig.getSpec(),
		},
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: idpResource.name,
	});

	log(result);
	if (!result.data) {
		const errMsg = 'cannot create a new agent';
		if (result.error?.length) {
			throw Error(`${errMsg}: ${result.error[0].detail}.`);
		} else {
			throw Error(`${errMsg}.`);
		}
	} else {
		console.log(
			`New Identity Provider of type "${defs[0].resource.name}" named "${result.data.name}" has been successfully created.`
		);
	}
	return result.data;
};

/**
 * @description Helper func to check for existing secret, and clean up old secret before creating a new one.
 * @param namespace Namespace to create the secret in.
 * @param secretName The name of the secret.
 * @param createFunc A function that will create the secret
 */
export const createSecret = async (namespace: string, secretName: string, createFunc: () => Promise<void>) => {
	const secrets = await kubectl.get('secrets', `-n ${namespace} ${secretName}`);
	// NotFound errors are ok. Throw an error for anything else.
	if (secrets.error && !secrets.error.includes('NotFound')) {
		throw Error(secrets.error);
	}

	// delete the secret if it already exists and then re-create it.
	if (secrets.data.length > 0) {
		await kubectl.delete('secret', `-n ${namespace} ${secretName}`);
	}

	await createFunc();
};
