import Command from '../../lib/command.js';
import { Args, Flags } from '@oclif/core';
import { commonFlags } from '../../lib/engage/flags.js';
import logger, { highlight } from '../../lib/logger.js';
import {
	ApiServerClientBulkResult,
	ApiServerClientSingleResult,
	GenericResource,
	YesNo,
	YesNoChoices,
} from '../../lib/engage/types.js';
import { ApiServerClient } from '../../lib/engage/clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../lib/engage/results/DefinitionsManager.js';
import Renderer from '../../lib/engage/results/renderer.js';
import { askList } from '../../lib/engage/utils/basic-prompts.js';
import { loadAndVerifySpecs, parseScopeParam, verifyFile, verifyScopeParam } from '../../lib/engage/utils/utils.js';
import chalk from 'chalk';

export default class EngageDelete extends Command {
	static override summary = 'Delete resources.';

	static override aliases = [ 'central:delete' ];

	static override description = `You must be authenticated to delete one or more resources.
	Run ${highlight('"axway auth login"')} to authenticate.`;

	static override examples = [
		{
			description: 'Delete resources from a file',
			command: '<%= config.bin %> <%= command.id %> --file <FilePath>',
		},
		{
			description: 'Delete a single resource',
			command: '<%= config.bin %> <%= command.id %> <Resource> <Name>',
		},
		{
			description: 'Delete a scoped resource in all scopes with a specific name',
			command: '<%= config.bin %> <%= command.id %> <Resource> <Name> --scope <Scope Name> --yes',
		},
		{
			description: 'Delete a scoped resource in a specific scope',
			command: '<%= config.bin %> <%= command.id %> <Resource> <Name> --scope <Scope Kind>/<Scope Name>',
		},
	];

	static override args = {
		resource: Args.string({
			description: 'Resource type to delete.',
			required: false,
		}),
		name: Args.string({
			description: 'Name of the resource to delete.',
			required: false,
		}),
	};

	static override flags = {
		...commonFlags,
		file: Flags.string({
			char: 'f',
			description: 'Filename to use to delete the resource.',
		}),
		scope: Flags.string({
			char: 's',
			description: 'Scope name or kind/name for scoped resources.',
		}),
		yes: Flags.boolean({
			char: 'y',
			description: 'Automatically reply "yes" to any command prompts.',
		}),
		wait: Flags.boolean({
			description: 'Wait for the resources to be completely deleted.',
		}),
		forceDelete: Flags.boolean({
			description: 'Force delete a resource (Warning: Ignores finalizers on the resource and the resources scoped under it)',
		}),
	};

	private printInvalidArgsUsage() {
		this.log(`\nUSAGE:
To delete resources by filenames:\t"axway engage delete -f/--file <path>
To delete a single resource:\t\t"axway engage delete <Resource> <Name>"`);
	}

	private printMissingArgsUsage(defsHelpTable: string) {
		this.log(`\nUSAGE:

  To delete resources by filename:
    ${chalk.cyan('axway engage delete -f/--file <path>')}\n
  To delete a single non-scoped resource:
    ${chalk.cyan('axway engage delete <Resource> <Name>')}\n
  To delete a scoped resource in all scopes with a specific name without confirmation dialog:
    ${chalk.cyan('axway engage delete <Resource> <Name> -s/--scope <Scope Name> --yes')}\n
  To delete a scoped resource in a specific scope:
    ${chalk.cyan('axway engage delete <Resource> <Name> -s/--scope <Scope Kind>/<Scope Name>')}\n
The server supports the following resources:

${defsHelpTable}`);
	}

	private async confirmSingleDelete(scopeProvided: boolean, matchingDefsLength: number): Promise<void> {
		let result = YesNo.Yes;
		if (!scopeProvided) {
			result = await askList({
				msg: 'Deleting this will delete all resources under its scope. Are you sure you want to do this?',
				choices: YesNoChoices,
				default: YesNo.No,
			}) as YesNo;
		} else if (matchingDefsLength > 1) {
			result = await askList({
				msg: 'The resource may exist in many scopes, and multiple entities might be deleted. Do you want to continue?',
				choices: YesNoChoices,
				default: YesNo.No,
			}) as YesNo;
		}
		if (result === YesNo.No) {
			process.exit(1);
		}
	}

	private async confirmForceDelete(): Promise<void> {
		const result = await askList({
			msg: 'Are you sure you want to force delete this resource?',
			choices: YesNoChoices,
			default: YesNo.No,
		}) as YesNo;
		if (result === YesNo.No) {
			process.exit(1);
		}
	}

	private async runSingleDelete({
		typedResource,
		typedName,
		scope,
		flags,
		defsManager,
		client,
		render,
	}: {
		typedResource: string;
		typedName?: string;
		scope: ReturnType<typeof parseScopeParam>;
		flags: any;
		defsManager: DefinitionsManager;
		client: ApiServerClient;
		render: Renderer;
	}): Promise<boolean> {
		const defs = defsManager.findDefsByWord(typedResource);
		if (!defs) {
			throw new Error(`the server doesn't have a resource type "${typedResource}"`);
		}
		if (!typedName) {
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

		if (!flags.yes) {
			await this.confirmSingleDelete(!!scope, matchingDefs.length);
		}

		if (!flags.yes && flags.forceDelete) {
			await this.confirmForceDelete();
		}

		render.startSpin(`Deleting resources${flags.wait ? ' and waiting for them to be deleted' : ''}`);

		const results: ApiServerClientSingleResult[] = await Promise.all(
			matchingDefs.map(async (def) =>
				client.deleteResourceByName({
					resourceDef: def.resource,
					resourceName: typedName,
					scopeDef: def.scope,
					scopeName: scope?.name,
					wait: flags.wait,
					forceDelete: flags.forceDelete,
				})
			)
		);

		const isCmdError = !results.filter((res) => res.data !== null).length;
		results.forEach((res) => {
			if (isCmdError && res.error?.length) {
				render.anyError(res.error[0]);
			} else if (!res.error?.length && res.data) {
				render.success(`${render.resourceAndScopeKinds(res.data)} has successfully been deleted.`);
			}
		});

		return isCmdError;
	}

	private async runBulkDelete({
		flags,
		defsManager,
		client,
		render,
	}: {
		flags: any;
		defsManager: DefinitionsManager;
		client: ApiServerClient;
		render: Renderer;
	}): Promise<{ isCmdError: boolean; bulkResults: ApiServerClientBulkResult }> {
		render.startSpin(`Deleting resources${flags.wait ? ' and waiting for them to be deleted' : ''}`);
		verifyFile(flags.file);
		const { docs } = await loadAndVerifySpecs(flags.file, defsManager.getAllKindsList());
		const bulkResults = await client.bulkDelete(
			docs as GenericResource[],
			defsManager.getSortedKindsMap(),
			flags.wait,
			flags.forceDelete
		);
		render.bulkResult(bulkResults, 'has successfully been deleted.');
		return { isCmdError: !!bulkResults.error.length, bulkResults };
	}

	async run(): Promise<any> {
		const log = logger('EngageDelete');
		const { args, flags, account } = await this.parse(EngageDelete);

		let isCmdError = true; // let's be pessimistic.
		let bulkResults: ApiServerClientBulkResult = { success: [], error: [] };

		const typedResource = args.resource;
		const typedName = args.name;
		const render = new Renderer(console);
		const client = new ApiServerClient({ account, region: flags.region, useCache: flags.cache });
		const defsManager = new DefinitionsManager(client);

		if (flags.file && typedResource) {
			render.error('Error: Invalid command arguments, please provide a file path or resource type and name.');
			this.printInvalidArgsUsage();
			process.exit(1);
		}

		try {
			log('load and verify specs');
			await defsManager.init();
			const scope = parseScopeParam(flags.scope);

			if (!flags.file && !typedResource) {
				render.error('Error: You must specify the type and name of the resource to delete or a file path.');
				this.printMissingArgsUsage(defsManager.getDefsTableForHelpMsg());
				process.exit(1);
			}

			if (typedResource) {
				log('executing api calls in single delete mode');
				isCmdError = await this.runSingleDelete({
					typedResource,
					typedName,
					scope,
					flags,
					defsManager,
					client,
					render,
				});
			} else if (flags.file) {
				log('executing api calls in bulk delete mode');
				log(`verifying file: ${flags.file}`);
				const result = await this.runBulkDelete({ flags, defsManager, client, render });
				isCmdError = result.isCmdError;
				bulkResults = result.bulkResults;
			}
		} catch (e: any) {
			log('command error', e);
			// if some calls finished, rendering the result
			if (bulkResults.success.length || bulkResults.error.length) {
				render.bulkResult(bulkResults, 'has successfully been deleted.');
			}
			render.anyError(e);
		} finally {
			log(`command finished, success = ${!isCmdError}`);
			render.stopSpin();
			if (isCmdError) {
				process.exit(1);
			}
		}
	}
}
