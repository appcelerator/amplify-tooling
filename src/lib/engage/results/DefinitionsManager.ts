import logger from '../../logger.js';
import Table from 'easy-table';
import loadash from 'lodash';
import { ApiServerClient } from '../clients-external/apiserverclient.js';
import { ResourceDefinition, CommandLineInterface, GetSpecsResult } from '../types.js';
import chalk from 'chalk';

const { log } = logger('engage:class.DefinitionsManager');

export interface FindDefsByWordResult {
	resource: ResourceDefinition;
	cli: CommandLineInterface;
	scope?: ResourceDefinition;
}

/**
 * Get / fetch / set specs.
 */
export class DefinitionsManager {
	apiServerClient: ApiServerClient;
	specs?: GetSpecsResult;
	cli = new Map<string, CommandLineInterface>();
	resources = new Map<string, ResourceDefinition>();

	constructor(apiServerClient: ApiServerClient) {
		this.apiServerClient = apiServerClient;
	}
	/**
	 * Private
	 */

	/**
	 * A reducer for sorting ResourceDefinition by references in the sortByReferences's "fromTo" list.
	 * Function utilize current "fromTo" list which is expected to be passed in { sorted, unsorted } form
	 * and "from" list which is used to find references for entities in the "fromTo" list.
	 * IF resource's "to" references still in "unsorted" list - put it back to unsorted also
	 * (its too early for the resource to be sorted).
	 * ELSE resource's "to" links are in the "from" list or/and current "sorted" list - find max index
	 * and append to "right-most" position of the "sorted" list
	 * @param curr
	 * @param defsFrom
	 */
	private reduceByReferenceLinks(
		curr: { sorted: ResourceDefinition[]; unsorted: ResourceDefinition[] },
		defsFrom: ResourceDefinition[]
	): { sorted: ResourceDefinition[]; unsorted: ResourceDefinition[] } {
		return curr.unsorted.reduce<{ sorted: ResourceDefinition[]; unsorted: ResourceDefinition[] }>(
			(a, c, _, arr) => {
				// IF any unsorted reference found, push current definition to unsorted too and skip
				const unsortedRefs = c.spec?.references?.toResources?.find((ref) => {
					return (
						loadash.findLastIndex(arr, (def) => def.spec.kind === ref.kind && def.spec.scope?.kind === ref.scopeKind) !== -1
					);
				});
				if (unsortedRefs) {
					a.unsorted.push(c);
				} else {
					// ELSE all refs are in pre populated or in sorted lists, calculate
					const startIndex
						= loadash.max(
							c.spec.references.toResources.map((ref) => {
								// find index in current sorted array
								const sortedListIndex = loadash.findLastIndex(
									a.sorted,
									(def) => def.spec.kind === ref.kind && def.spec.scope?.kind === ref.scopeKind
								);
								// find index in "from-only" array
								const fromListIndex = loadash.findLastIndex(
									defsFrom,
									(def) => def.spec.kind === ref.kind && def.spec.scope?.kind === ref.scopeKind
								);
								// this should never happen only if the api-server is missing some corresponding
								// references so nothing found
								if (sortedListIndex === -1 && fromListIndex === -1) {
									log('reduceByReferenceLinks, startIndex not found for ref: ', ref, ' in def: ', c.spec.kind);
									return null;
								} else { // if nothing found in sorted and pre return null so it will put it back to unsorted
									return sortedListIndex === -1 ? 0 : sortedListIndex;
								}
							})
						) ?? null;
					const stopIndex
						= loadash.min(
							c.spec?.references?.fromResources?.map((ref) => {
								const i = loadash.findIndex(
									a.sorted,
									(def) => def.spec.kind === ref.kind && def.spec.scope?.kind === ref.scopeKind
								);
								return i === -1 ? null : i;
							})
						) ?? null;

					if ((startIndex && stopIndex && startIndex >= stopIndex) || startIndex === null) {
						log('reduceByReferenceLinks, indexes error, skipping definition: ', c.spec.kind, ' in scope: ', c.spec.scope?.kind);
						a.unsorted.push(c);
					} else {
						a.sorted.splice(startIndex + 1, 0, c);
					}
				}

				return a;
			},
			{ sorted: curr.sorted, unsorted: [] }
		);
	}

	/**
	 * Utility for sorting ResourceDefinition by refs. Its grouping resources into 4 arrays and
	 * iterates over the "fromTo" list with "reduceByReferenceLinks" reducer until its completely sorted.
	 * @param defs list of resources to sort
	 */
	private sortByReferences(defs: ResourceDefinition[]): ResourceDefinition[] {
		// 1. Sort by references into 4 arrays
		const groupedDefs = defs.reduce<{
			noRefs: ResourceDefinition[]; // defs without any reference
			from: ResourceDefinition[]; // defs with only "from" references
			fromTo: ResourceDefinition[]; // defs with "from" and "to" references
			to: ResourceDefinition[]; // defs with only "to" references
		}>(
			(a, c) => {
				const fromRefsNum = c.spec?.references?.fromResources?.length ?? 0;
				const toRefsNum = c.spec?.references?.toResources?.length ?? 0;
				if (fromRefsNum && toRefsNum) {
					a.fromTo.push(c);
				} else if (!fromRefsNum && !toRefsNum) {
					a.noRefs.push(c);
				} else if (!toRefsNum) {
					a.from.push(c);
				} else if (!fromRefsNum) {
					a.to.push(c);
				}
				return a;
			},
			{
				noRefs: [],
				from: [],
				fromTo: [],
				to: [],
			}
		);

		// 2. Iterate over "fromTo" defs until its completely sorted
		let result = this.reduceByReferenceLinks({ sorted: [], unsorted: groupedDefs.fromTo }, groupedDefs.from);
		let loopCount = 0; // just in case, circuit breaker;
		while (result.unsorted.length > 0 && loopCount <= 1000) {
			result = this.reduceByReferenceLinks(result, groupedDefs.from);
			loopCount += 1;
		}
		// On average function should not take more than 5 loops currently.
		// Lets signal that something is wrong here.
		if (loopCount === 1000) {
			log('sortByReferences, max loop count reached, some definitions may be out of order: ', result.unsorted.map((d) => d.spec?.kind));
		}
		return [ ...groupedDefs.noRefs, ...groupedDefs.from, ...result.sorted, ...groupedDefs.to ];
	}

	/**
	 * Public
	 * Constructs two maps per resource group(e.g. management, catalog)
	 * First map is for the nested 'cli' object and the other is for the nested 'resource' object
	 * Created by stripping the 'definitions' group from the specs object, leaving only the 'management' and 'catalog' groups as of 6/7
	 * (this will dynamically update in case new groups are added on api-server)
	 * Then iterating over that specs object and pushing the cli and resource objects for each group into arrays, which are used to initialize the final maps
	 */
	async init(): Promise<DefinitionsManager> {
		log('init');
		this.specs = await this.apiServerClient.getSpecs();
		const filteredSpecs = loadash.omit(this.specs, 'definitions');
		const cliArray = [];
		const resourcesArray = [];
		for (const [ key ] of Object.entries(filteredSpecs)) {
			resourcesArray.push(...filteredSpecs[key].resources);
			cliArray.push(...filteredSpecs[key].cli);
		}
		this.cli = new Map(cliArray);
		this.resources = new Map(resourcesArray);
		return this;
	}

	getAllWordsList(): string[] {
		if (!this.specs) {
			return [];
		}
		const result: string[] = [];
		this.cli.forEach((v) => {
			result.push(v.spec.names.plural, v.spec.names.singular, ...v.spec.names.shortNames);
		});
		return result;
	}

	getAllKindsList(): Set<string> {
		if (!this.specs) {
			throw Error('DefinitionManager.specs is not initialized.');
		}
		const result: Set<string> = new Set([]);
		this.resources.forEach((v) => {
			if (v?.spec?.kind) {
				result.add(v.spec.kind);
			}
		});
		return result;
	}

	/**
	 * Get the map with resources definitions sorted by references.
	 * Used to identify the correct order in which resources should be created / removed.
	 * @returns {Map<string,ResourceDefinition>} map where key is ResourceDefinition.name, value is ResourceDefinition
	 */
	getSortedKindsMap(): Map<string, ResourceDefinition> {
		if (!this.specs) {
			throw Error('DefinitionManager.specs is not initialized.');
		}
		// For each spec modify the references:
		// 1. since cli do not support creating or updating sub-resources we are ignoring references and removing them atm.
		// 2. if it is a scoped resource, add a manual "to" reference to the scope resource and a corresponding "from"
		// reference in the scope resource
		this.resources.forEach((definition) => {
			if (!definition?.spec?.references) {
				return;
			}
			// 1. remove the references from the sub-resources and circular references (to self)
			// TODO: circular references support: https://jira.axway.com/browse/APIGOV-20808
			definition.spec.references.toResources = definition.spec.references.toResources.filter(
				(ref) => !ref.from && !(ref.kind === definition.spec.kind && ref.scopeKind === definition.spec.scope?.kind)
			);
			definition.spec.references.fromResources = definition.spec.references.fromResources.filter(
				(ref) => !ref.from && !(ref.kind === definition.spec.kind && ref.scopeKind === definition.spec.scope?.kind)
			);
			// 2. add references between scope and scoped resources
			if (definition.spec.scope) {
				const scopeDef = [ ...this.resources.values() ].find((res) => res.spec?.kind === definition.spec.scope!.kind);
				if (!scopeDef) {
					return;
				}
				// modify current definition by adding "toResources" link to scopeDef
				if (!definition.spec.references.toResources.find((ref) => ref.kind === scopeDef.spec.kind)) {
					definition.spec.references.toResources.push({
						kind: scopeDef.spec.kind,
						// NOTE: not used value, adding just to indicate it's manual nature.
						// @ts-ignore
						types: [ 'CALCULATED' ],
					});
				}
				// modify related "scope" definition by adding "fromResources" link to current definition
				if (!scopeDef.spec.references.fromResources.find((ref) => ref.kind === definition.spec.kind)) {
					scopeDef.spec.references.fromResources.push({
						kind: definition.spec.kind,
						// @ts-ignore
						// NOTE: not used value, adding just to indicate it's manual nature.
						types: [ 'CALCULATED' ],
						scopeKind: definition.spec.scope.kind,
					});
				}
			}
		});
		// execute the sorting, note that the returning map is using the "name" field as keys.
		const res = this.sortByReferences([ ...this.resources.values() ].filter((v) => v?.spec?.references));
		return new Map(res.map((v) => [ v.name, v ]));
	}

	getDefsTableForHelpMsg(): string {
		if (!this.specs) {
			return 'No resources found.';
		}
		const t = new Table();

		// create the 'axway central get' table
		this.cli.forEach((v) => {
			// grab the resource group
			const group = v.metadata.scope.name;
			t.cell('RESOURCE', `${v.spec.names.plural}`, () => chalk.cyan(v.spec.names.plural));
			t.cell('SHORT NAMES', [ ...(v.spec.names.shortNamesAlias || v.spec.names.shortNames) ].join(','));
			t.cell('RESOURCE KIND', this.resources.get(v.spec.resourceDefinition)?.spec.kind);
			t.cell('SCOPED', this.resources.get(v.spec.resourceDefinition)?.spec.scope ? 'true' : 'false');
			t.cell('SCOPE KIND', this.resources?.get(v.spec.resourceDefinition)?.spec.scope?.kind);
			t.cell('RESOURCE GROUP', group);
			t.newRow();
		});
		return t.sort([ 'RESOURCE' ]).toString();
	}

	findDefsByKind(kind: string): null | FindDefsByWordResult[] {
		log('findDefsByKind: ', kind);

		const res = [ ...this.resources ].reduce<
			{ resource: ResourceDefinition; cli: CommandLineInterface; scope?: ResourceDefinition }[]
		>((a, [ _, def ]) => {
			if (def.spec.kind === kind) {
				a.push({
					resource: def,
					cli: [ ...this.cli ].find(([ _, cliDef ]) => cliDef.spec.resourceDefinition === def.name)![1],
					scope: def.spec.scope
						? [ ...this.resources ].find(([ _, resDef ]) => resDef.spec.kind === def.spec.scope!.kind)![1]
						: undefined,
				});
			}
			return a;
		}, []);
		return res.length ? res : null;
	}

	/**
	 * Returns set of related definitions if word is known.
	 * @param word word to search for
	 * @returns {object | null} {
	 *   resource: definition of the resource
	 *   cli: cli definition of the resource
	 *   scope: scope resource definition, can support multiple scopes (only for scoped resources, otherwise it is undefined)
	 * } or null if no definitions found for this word.
	 */
	findDefsByWord(word: string): null | FindDefsByWordResult[] {
		log('findDefsByWord: ', word);
		if (!this.specs) {
			return null;
		}
		const cliKv = [ ...this.cli ].filter(
			([ _, v ]) =>
				v.spec?.names.plural === word
				|| v.spec?.names.singular === word
				|| v.spec?.names.shortNames.includes(word)
				|| v.spec?.names.shortNamesAlias?.includes(word)
		);
		// no match found returning null
		if (!cliKv.length) {
			return null;
		}
		const result = [ ...this.cli ].reduce<
			{ resource: ResourceDefinition; cli: CommandLineInterface; scope?: ResourceDefinition }[]
		>((a, [ _, cliDef ]) => {
			if (
				cliDef.spec?.names.plural === word
				|| cliDef.spec?.names.singular === word
				|| cliDef.spec?.names.shortNames.includes(word)
				|| cliDef.spec?.names.shortNamesAlias?.includes(word)
			) {
				// note: mind non-null assertion
				const resource = this.resources.get(cliDef.spec.resourceDefinition)!;
				const scope = resource.spec.scope ? this.findDefsByKind(resource.spec.scope.kind)?.[0].resource : null;
				a.push({
					resource,
					cli: cliDef,
					scope: scope ? scope : undefined,
				});
			}
			return a;
		}, []);
		return result;
	}
}
