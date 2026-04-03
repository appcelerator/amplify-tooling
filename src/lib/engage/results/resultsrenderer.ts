import chalk from 'chalk';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import Table from 'easy-table';

dayjs.extend(relativeTime);
import { dump } from 'js-yaml';
import _ from 'lodash';
import { CommandLineInterfaceColumns, GenericResource, MAX_TABLE_STRING_LENGTH, OutputTypes } from '../types.js';
import { initSDK } from '../../amplify-sdk/index.js';

/**
 * HACK: removing "---" delimiter printing from the lib.
 * Currently this is not supported in library itself so have to override prototype methods.
 */
Table.prototype.pushDelimeter = function () {
	return this;
};

/**
 * Parse JSON object | array of objects as YAML
 * @param response request response payload
 * @param console current console
 * @returns parsed string with YAML objects representation
 */
export const parseAsYaml = (response: object | object[]): string => {
	let result = '';
	if (Array.isArray(response)) {
		for (const i of response) {
			result += `\n---\n${dump(i)}`;
		}
	} else {
		result = dump(response);
	}
	return result;
};

/**
 * Parse JSON object | array of objects as simple text table,
 * NOTE: currently can build table only for "Environment" type.
 * @param response request response payload
 * @param console current console
 * @param columns columns config from CommandLineInterface resource definition
 *  @returns parsed string with table objects representation
 */
const parseAsTable = (
	response: GenericResource | GenericResource[],
	columns: CommandLineInterfaceColumns[]
): string => {
	const data = Array.isArray(response) ? response : [response];
	const t = new Table();
	for (const i of data) {
		for (const col of columns) {
			// jsonPath starts with '.' so using the substring
			let value: string | undefined = _.get(i, col.jsonPath.substring(1));
			const deletingState: boolean = _.get(i, 'metadata.state');
			if (col.type === 'date') {
				value = dayjs(value).fromNow();
			} else if (col.type === 'teamGuid' && !value) {
				value = chalk.gray('---');
			} else if (value && value.length > MAX_TABLE_STRING_LENGTH + 3) {
				value =
					value.substring(0, MAX_TABLE_STRING_LENGTH / 2) +
					'...' +
					value.substring(value.length - MAX_TABLE_STRING_LENGTH / 2);
			}
			if (deletingState) {
				t.cell(col.name.toUpperCase(), chalk.yellow(value));
			} else {
				t.cell(col.name.toUpperCase(), value);
			}
		}
		t.newRow();
	}
	return data.length ? `\n${t.toString()}` : '\nNo resources found.';
};

/**
 * Parse JSON object | array of objects as is but without any replacing like [object Object].
 * @param response request response payload
 * @param console current console
 * @returns parsed string with JSON objects representation
 */
export const parseAsJson = (response: object | object[]): string => JSON.stringify(response, null, 4);

/**
 * Util function to render JSON object | array of objects based on output type provided
 * @param response request response payload
 * @param output type of output to render (table (default) / yaml / json)
 * @param console current console
 */
export const renderResponse = (
	console: Console,
	response: object | object[],
	output?: OutputTypes,
	columns?: CommandLineInterfaceColumns[]
): void => {
	switch (output) {
		case OutputTypes.yaml:
			console.log(parseAsYaml(response));
			break;
		case OutputTypes.json:
			console.log(parseAsJson(response));
			break;
		default:
			// @ts-expect-error TODO: fix types error once more types are used
			console.log(parseAsTable(response, columns));
	}
};

interface TeamNameLookup {
	[guid: string]: string;
}

interface Result {
	data: object[];
}

/**
 * If a team guid column is being rendered, it resolves the team name and injects it into
 * the response payload.
 * @param columns an array of columns being rendered
 * @param response request response payload
 */
export async function resolveTeamNames({
	columns,
	response,
	account
}: {
	columns?: CommandLineInterfaceColumns[];
	response: object | object[];
	account?: Account;
}) {
	// check that we even have a team guid column
	const column = columns?.find((col) => col.type === 'teamGuid');
	if (!column || !account) {
		return;
	}

	const jsonPath = column.jsonPath.substring(1);
	const results = Array.isArray(response) ? response : [response];
	const teamNames: TeamNameLookup = {};
	const sdk = await initSDK({ env: account?.auth.env });

	// build the team name lookup
	const { teams } = await sdk!.team.list(account, account?.org.guid);
	for (const team of teams) {
		teamNames[team.guid] = team.name;
	}

	// create the new jsonPath and update the column
	const targetJsonPath = jsonPath.split('.').slice(0, -1).join('.') + '.teamName';
	column.jsonPath = `.${targetJsonPath}`;

	// next loop over data and set the team name
	for (let { data } of results as Result[]) {
		if (!data || typeof data !== 'object') {
			continue;
		}
		if (!Array.isArray(data)) {
			data = [data];
		}
		for (const obj of data) {
			const value = _.get(obj, jsonPath, null);
			if (value !== null) {
				_.set(obj, targetJsonPath, (value && teamNames[value]) || value || '');
			}
		}
	}
}
