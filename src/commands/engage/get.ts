import Command from '../../lib/command.js';
import { Args, Flags } from '@oclif/core';
import { ApiServerClientListResult, ApiServerClientSingleResult, CommandLineInterfaceColumns, LanguageTypes, OutputTypes, PlatformTeam } from '../../lib/types.js';
import { commonFlags } from '../../lib/engage/flags.js';
import logger, { highlight } from '../../lib/logger.js';
import Renderer from '../../lib/results/renderer.js';
import { ApiServerClient } from '../../lib/clients-external/apiserverclient.js';
import { DefinitionsManager, FindDefsByWordResult } from '../../lib/results/DefinitionsManager.js';
import { getFieldSetFromDefinitionColumns, parseScopeParam, transformSimpleFilters, verifyScopeParam } from '../../lib/utils/utils.js';
import chalk from 'chalk';
import { resolveTeamNames } from '../../lib/results/resultsrenderer.js';

export default class EngageGet extends Command {
	static override summary = 'List one or more resources.';

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
		const log = logger('EngageGet');
		const { args, flags, account, teams } = await this.parse(EngageGet);

		if (!flags.team && flags.owner) {
			// no --team set and --no-owner was set, so we set the team to `null` which will know
			// to get teams that do not have an owner
			flags.team = null;
		}

		// will be set to true and exit 1 if any get result contains an error or args invalid
		let isCmdError = true;
		// name can be provided or not (args[0] is the resource type)
		const resourceName: string | undefined = args.name;
		// verify output argument
		if (!!flags.output && !(flags.output in OutputTypes)) {
			throw Error(`invalid "output" (-o,--output) value provided, allowed: ${OutputTypes.yaml} | ${OutputTypes.json}`);
		}

		const renderer = new Renderer(console, flags.output);
		const getResults: {
			columns: CommandLineInterfaceColumns[];
			response: ApiServerClientSingleResult | ApiServerClientListResult;
		}[] = [];
		try {
			// get specs and allowed words
			const client = new ApiServerClient({ region: flags.region, account: account, useCache: flags.cache, team: flags.team });
			const defsManager = await new DefinitionsManager(client).init();
			const scope = parseScopeParam(flags.scope);
			let languageExpand = flags.language;
			const languageDefinition = flags.languageDefinition;
			let teamGuid: string | undefined;
			if (flags.team) {
				const team = teams?.teams?.find((t: PlatformTeam) => {
					return t.guid.toLowerCase() === flags.team.toLowerCase() || t.name.toLowerCase() === flags.team.toLowerCase();
				});
				if (!team) {
					throw new Error(`Unable to find team "${flags.team}" in the "${account.org.name}" organization`);
				}
				teamGuid = team.metadata.guid;
			}
			const formattedFilter = transformSimpleFilters(flags.title, flags.attribute, flags.tag, teamGuid);
			const query = flags.query ? flags.query : formattedFilter;
			// verify either "--language" or "--languageDefinition" argument is passed and error when both are passed
			if (languageExpand && languageDefinition) {
				throw Error('You must specify either of the "--language" or "--languageDefinition" argument and not both.');
			}
			if (languageDefinition && !flags.output) {
				throw Error('The "--languageDefinition" argument can only be used with output(-o,--output) argument');
			}
			if (languageExpand) {
				// when "*" is provided, expand all supported languages
				let lang = '';
				let i = 0;
				if (languageExpand.trim() === '*') {
					lang = 'languages-*';
				} else {
					const langCodeArr = languageExpand.split(',');
					langCodeArr.forEach(v => {
						if (i < langCodeArr.length - 1) {
							lang = lang + 'languages-' + v.trim() + ',';
						} else {
							lang = lang + 'languages-' + v.trim();
						}
						i++;
					});
				}
				languageExpand = 'languages,' + lang;
			}
			if (flags.query && formattedFilter) {
				console.log(
					`${chalk.yellow(
						'Both simple queries and advanced query parameters have been provided. Only the advanced query parameter will be applied.'
					)}`
				);
			}
			// verify passed args
			if (!args.resource) {
				renderer.error('Error: You must specify the type of resource to get.');
				this.log('\nThe server supports the following resources:\n');
				this.log(defsManager.getDefsTableForHelpMsg());
				process.exit(1);
			}

			// Start showing download progress.
			const downloadMessage = 'Retrieving resource(s)';
			renderer.startSpin(downloadMessage);
			const progressListener = (percent: number) => {
				renderer.updateSpinText(`${downloadMessage} - ${percent}%`);
			};

			// parse passed resources types (if passed comma-separated)
			for (const typedResource of args.resource.split(',')) {
				const defs = defsManager.findDefsByWord(typedResource);
				// is typed resource known?
				if (!defs) {
					throw Error(`the server doesn't have a resource type "${typedResource}"`);
				}
				// check if a user is trying to get a scoped-only resource by name without providing a scope name
				if (defs.every((defs) => !!defs.scope) && resourceName && !scope) {
					throw Error(
						`scope name param (-s/--scope) is required for the scoped "${defs[0].resource.spec.kind}" resource.`
					);
				}
				// verify passed scope param kind
				verifyScopeParam(defsManager.getAllKindsList(), defs, scope);

				/**
				 	1) If "scope" param provided: execute getByName or getList calls for every definition that match this scope name/kind.
					2) If "scope" param is not provided: execute list (get all) api calls for scoped resources without providing the scope in
					the path so api-server returns the entire list in all scopes. For example, using "Document" kind and calling
					https://apicentral.axway.com/apis/catalog/v1alpha1/documents returns a list of documents in Asset and AssetRelease
					scopes in a single api call. So getting unique list of groups and finding first matching definitions to do a call
					Note: this logic might have some edge cases if same kind can be used for "scoped" and "scope" resources and api-server is
					not handling this case correctly anymore.
				 */
				if (scope) {
					const results = await Promise.all(
						defs
							.filter((defs) => !scope.kind || !defs.scope || defs.scope.spec.kind === scope.kind)
							.map(async (defs) => ({
								response: await client.getListOrByName(
									{
										resourceDef: defs.resource,
										scopeName: scope?.name,
										resourceName,
										scopeDef: defs.scope,
										query,
										progressListener,
										expand: languageExpand,
										langDef: languageDefinition,
										fieldSet: flags.output ? undefined : getFieldSetFromDefinitionColumns(defs),
									}
								),
								cli: defs.cli,
							}))
					);
					results.forEach(({ response, cli }) => {
						getResults.push({
							columns: cli.spec.columns,
							response,
						});
					});
				} else {
					const defsMatchingGroup: { [groupName: string]: FindDefsByWordResult } = {};
					defs.forEach((def) => {
						if (!defsMatchingGroup[def.resource.metadata.scope?.name]) {
							defsMatchingGroup[def.resource.metadata.scope?.name] = def;
						}
					});
					const results = await Promise.all(
						Object.values(defsMatchingGroup).map(async (defs) => ({
							response: await client.getListOrByName({
								resourceDef: defs.resource,
								scopeName: scope?.name,
								resourceName,
								scopeDef: undefined,
								query,
								progressListener,
								expand: languageExpand,
								langDef: languageDefinition,
								fieldSet: flags.output ? undefined : getFieldSetFromDefinitionColumns(defs),
							}),
							cli: defs.cli,
						}))
					);
					results.forEach(({ response, cli }) => {
						getResults.push({
							columns: cli.spec.columns,
							response,
						});
					});
				}
			}
			// resolve team guids
			for (const obj of getResults) {
				await resolveTeamNames({ ...obj, account });
			}

			// considering the command successful if at least 1 response found
			isCmdError = !getResults.filter((res) => res.response.data !== null).length;
			renderer.renderGetResults(getResults, 'Resource(s) successfully retrieved', languageDefinition);
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
