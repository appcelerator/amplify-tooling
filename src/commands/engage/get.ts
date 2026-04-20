import Command from '../../lib/command.js';
import { Args, Flags } from '@oclif/core';
import { LanguageTypes, OutputTypes, PlatformTeam } from '../../lib/engage/types.js';
import { commonFlags } from '../../lib/engage/flags.js';
import logger, { highlight } from '../../lib/logger.js';
import Renderer from '../../lib/engage/results/renderer.js';
import { getResources } from '../../lib/engage/services/get-service.js';
import chalk from 'chalk';

export default class EngageGet extends Command {
	static override summary = 'List one or more resources.';

	static override aliases = [ 'central:get' ];

	static override description = `You must be authenticated to list one or more resources.
	Run ${highlight('"axway auth login"')} to authenticate.`;

	static override examples = [
		{
			description: 'Get a list of resources',
			command: '<%= config.bin %> <%= command.id %> <Resource>',
		},
		{
			description: 'Get a list of multiple resources',
			command: '<%= config.bin %> <%= command.id %> <Resource1>,<Resource2>,...,<ResourceN>',
		},
		{
			description: 'Get a list of resources in a specific scope',
			command: '<%= config.bin %> <%= command.id %> <Resource> --scope <Scope Kind>/<Scope Name>',
		},
		{
			description: 'Get a list of resources matching a specific RSQL query',
			command: '<%= config.bin %> <%= command.id %> <Resource> --query "<RSQL query>"',
		},
		{
			description: 'Get a specific resource by name across all scopes',
			command: '<%= config.bin %> <%= command.id %> <Resource> <Name> --scope <Scope Name>',
		},
		{
			description: 'Get a specific resource by name in a specific scope',
			command: '<%= config.bin %> <%= command.id %> <Resource> <Name> --scope <Scope Kind>/<Scope Name>',
		},
	];

	static override args = {
		resource: Args.string({
			description: 'Resource type to get. Supports comma-separated values for multiple resources.',
			required: false,
		}),
		name: Args.string({
			description: 'Name of the specific resource to get.',
			required: false,
		}),
	};

	static override flags = {
		...commonFlags,
		output: Flags.string({
			char: 'o',
			description: `Additional output formats. One of: ${OutputTypes.yaml} | ${OutputTypes.json}`,
		}),
		scope: Flags.string({
			char: 's',
			description: 'Scope name or kind/name for scoped resources',
		}),
		query: Flags.string({
			char: 'q',
			description:
        'RSQL-formatted query to search for filters that match specific parameters',
		}),
		title: Flags.string({
			description: 'Title of resource(s) to fetch',
		}),
		attribute: Flags.string({
			description: 'Attribute in key=value pair format to filter by',
		}),
		tag: Flags.string({
			description: 'Tag of resource(s) to fetch',
		}),
		team: Flags.string({
			description: 'The team name or guid to use',
		}),
		'no-owner': Flags.boolean({
			description: 'Returns resources which do not have an owner',
		}),
		language: Flags.string({
			description: `Show the language detail of the returned object. One of: * | Comma Separated values of ${LanguageTypes.French} | ${LanguageTypes.US} | ${LanguageTypes.German} | ${LanguageTypes.Portugese}`,
		}),
		languageDefinition: Flags.string({
			description: `Show the language definition constraint of the returned object. One of: Comma Separated values of ${LanguageTypes.French} | ${LanguageTypes.US} | ${LanguageTypes.German} | ${LanguageTypes.Portugese}`,
		}),
	};

	async run(): Promise<any> {
		const log = logger('engage:get');
		const { args, flags, account, teams } = await this.parse(EngageGet);

		if (!flags.team && flags['no-owner']) {
			flags.team = null;
		}

		if (!!flags.output && !(flags.output in OutputTypes)) {
			throw Error(`invalid "output" (-o,--output) value provided, allowed: ${OutputTypes.yaml} | ${OutputTypes.json}`);
		}

		// Resolve team GUID (by name or guid) from the pre-fetched teams list.
		let teamGuid: string | undefined;
		if (flags.team) {
			const match = teams?.teams?.find((t: PlatformTeam) =>
				t.guid.toLowerCase() === flags.team.toLowerCase() ||
				t.name.toLowerCase() === flags.team.toLowerCase()
			);
			if (!match) {
				throw new Error(`Unable to find team "${flags.team}" in the "${account.org.name}" organization`);
			}
			teamGuid = match.metadata.guid;
		}

		// Warn if both simple and advanced query params were provided.
		if (flags.query && (flags.title || flags.attribute || flags.tag)) {
			console.log(chalk.yellow(
				'Both simple queries and advanced query parameters have been provided. Only the advanced query parameter will be applied.'
			));
		}

		const renderer = new Renderer(console, flags.output);
		let isCmdError = true;
		try {
			const downloadMessage = 'Retrieving resource(s)';
			renderer.startSpin(downloadMessage);
			const result = await getResources({
				account,
				region: flags.region,
				useCache: flags.cache,
				team: flags.team,
				resourceTypes: args.resource ? args.resource.split(',') : [],
				resourceName: args.name,
				scopeParam: flags.scope,
				query: flags.query,
				titleFilter: flags.title,
				attributeFilter: flags.attribute,
				tagFilter: flags.tag,
				teamGuid,
				languageExpand: flags.language,
				languageDefinition: flags.languageDefinition,
				outputFormat: flags.output,
				onProgress: (percent) => renderer.updateSpinText(`${downloadMessage} - ${percent}%`),
			});

			if (result.missingResourceArg) {
				renderer.stopSpin();
				renderer.error('Error: You must specify the type of resource to get.');
				this.log('\nThe server supports the following resources:\n');
				this.log(result.defsHelpTable ?? '');
				process.exit(1);
			}

			isCmdError = result.hasErrors;
			renderer.renderGetResults(result.items, 'Resource(s) successfully retrieved', result.languageDefinition);
		} catch (e: any) {
			log('command error', e);
			isCmdError = true;
			renderer.anyError(e);
		} finally {
			log('command complete');
			renderer.stopSpin();
			if (isCmdError) {
				process.exit(1);
			}
		}
	}
}
