import Command from '../../lib/command.js';
import { Args, Flags } from '@oclif/core';
import { commonFlags } from '../../lib/engage/flags.js';
import logger, { highlight } from '../../lib/logger.js';
import { YesNo, YesNoChoices } from '../../lib/engage/types.js';
import Renderer from '../../lib/engage/results/renderer.js';
import { deleteResources } from '../../lib/engage/services/delete-service.js';
import { askList } from '../../lib/engage/utils/basic-prompts.js';

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

	async run(): Promise<any> {
		const log = logger('EngageDelete');
		const { args, flags, account } = await this.parse(EngageDelete);

		const typedResource = args.resource;
		const typedName = args.name;
		const render = new Renderer(console);

		if (flags.file && typedResource) {
			render.error('Error: Invalid command arguments, please provide a file path or resource type and name.');
			this.printInvalidArgsUsage();
			process.exit(1);
		}

		let isCmdError = true;
		try {
			render.startSpin(`Deleting resources${flags.wait ? ' and waiting for them to be deleted' : ''}`);

			const result = await deleteResources({
				account,
				region: flags.region,
				useCache: flags.cache,
				resourceType: typedResource,
				resourceName: typedName,
				filePath: flags.file,
				scopeParam: flags.scope,
				wait: flags.wait,
				forceDelete: flags.forceDelete,
				skipConfirmation: flags.yes,
				onConfirmSingleDelete: async (scopeProvided, matchingDefsLength) => {
					render.stopSpin();
					let answer = YesNo.Yes;
					if (!scopeProvided) {
						answer = await askList({
							msg: 'Deleting this will delete all resources under its scope. Are you sure you want to do this?',
							choices: YesNoChoices,
							default: YesNo.No,
						}) as YesNo;
					} else if (matchingDefsLength > 1) {
						answer = await askList({
							msg: 'The resource may exist in many scopes, and multiple entities might be deleted. Do you want to continue?',
							choices: YesNoChoices,
							default: YesNo.No,
						}) as YesNo;
					}
					render.startSpin(`Deleting resources${flags.wait ? ' and waiting for them to be deleted' : ''}`);
					return answer !== YesNo.No;
				},
				onConfirmForceDelete: async () => {
					render.stopSpin();
					const answer = await askList({
						msg: 'Are you sure you want to force delete this resource?',
						choices: YesNoChoices,
						default: YesNo.No,
					}) as YesNo;
					render.startSpin(`Deleting resources${flags.wait ? ' and waiting for them to be deleted' : ''}`);
					return answer !== YesNo.No;
				},
			});

			if (result.missingArgs) {
				render.stopSpin();
				render.error('Error: You must specify the type and name of the resource to delete or a file path.');
				if (result.defsHelpTable) {
					this.log(`\nThe server supports the following resources:\n\n${result.defsHelpTable}`);
				}
				process.exit(1);
			}

			isCmdError = result.hasErrors;

			if (result.singleResults) {
				result.singleResults.forEach((res) => {
					if (isCmdError && res.error?.length) {
						render.anyError(res.error[0]);
					} else if (!res.error?.length && res.data) {
						render.success(`${render.resourceAndScopeKinds(res.data)} has successfully been deleted.`);
					}
				});
			}

			if (result.bulkResults) {
				render.bulkResult(result.bulkResults, 'has successfully been deleted.');
			}
		} catch (e: any) {
			log('command error', e);
			isCmdError = true;
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
