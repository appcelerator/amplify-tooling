import chalk from 'chalk';
import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../results/DefinitionsManager.js';
import { renderResponse } from '../results/resultsrenderer.js';
import { EditEnvironmentCommandParams, GenericResource, Kind } from '../types.js';
import TmpFile from '../utils/tmp-file.js';
import logger from '../../logger.js';
import { loadAndVerifySpecs } from '../utils/utils.js';

const log = logger('engage:services:edit-service');

export async function editEnvironment(params: EditEnvironmentCommandParams): Promise<void> {
	const { account, region, useCache, name, render, outputFormat } = params;

	const client = new ApiServerClient({ account, region, useCache, baseUrl: params.baseUrl });
	const defsManager = await new DefinitionsManager(client).init();
	const sortedKindsMap = defsManager.getSortedKindsMap();
	const resourceDef = Array.from(sortedKindsMap.values()).find(def => def.spec.kind === 'Environment');
	let commandIsSuccessful = true;
	let file: TmpFile | undefined;
	render.startSpin(`Fetching details of "environment/${name}.`);
	try {
		const response = await client.getResourceByName({ resourceDef, resourceName: name });
		if (response.error) {
			throw new Error(`Unable to retrieve Environment "${name}": ${response.error}`);
		}
		file = new TmpFile(response.data);
		// stop spinner or it will interfere stdio of editor
		render.stopSpin();
		const { isUpdated } = await file.edit();
		if (isUpdated) {
		// intentionally taking just first doc even if user will provide more in the same file while editing.
			const { docs } = await loadAndVerifySpecs(file.path, new Set([ Kind.Environment ]));
			const response = await client.updateResource({ resourceDef, resource: docs[0] as GenericResource });
			render.success(chalk`{greenBright "environment/${name}" has successfully been edited.}`);
			// render result if output flag has been provided
			if (outputFormat) {
				renderResponse(console, response);
			}
		} else {
			log('no changes has been made to file');
			render.error('Edit cancelled, no changes made.');
			file.delete();
			commandIsSuccessful = false;
		}
	} catch (e: any) {
		log('command error', e);
		if (file) {
			console.log(`A copy of your changes has been stored to "${file.path}".`);
		}
		render.anyError(e);
		commandIsSuccessful = false;
	} finally {
		log(`command finished, success = ${commandIsSuccessful}`);
		if (file && commandIsSuccessful) {
			file.delete();
		}
		render.stopSpin();
		if (!commandIsSuccessful) {
			process.exit(1);
		}
	}
}
