import chalk from 'chalk';
import { ApiServerClient } from '../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../results/DefinitionsManager.js';

export const deleteByResourceType = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	name: string,
	resourceType: string,
	resourceShortName: string,
	scopeName: string = ''
): Promise<void> => {
	console.log(`Deleting ${resourceType}`);
	// NOTE: only a first found set is used
	const defs = defsManager.findDefsByWord(resourceShortName);
	if (!defs) {
		throw Error(`the server doesn't have a resource type "${resourceType}"`);
	}
	const result = await client.deleteResourceByName({
		resourceName: name,
		resourceDef: defs[0].resource,
		scopeDef: defs[0].scope ? defs[0].scope : undefined,
		scopeName: defs[0].scope ? scopeName || name : undefined,
	});

	if (!result.data) {
		const errMsg = `error deleting resource ${resourceType.toLowerCase()}`;
		if (result.error?.length) {
			console.log(chalk.redBright(`${errMsg}: ${result.error[0].detail}.`));
		} else {
			console.log(chalk.redBright(`${errMsg}.`));
		}
	} else {
		console.log(`New ${resourceType.toLowerCase()} "${result.data.name}" has been successfully deleted.`);
	}
};
