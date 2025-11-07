import _ from 'lodash';
import { Hook, Performance } from '@oclif/core';
import { serializeError } from 'serialize-error';

import { type CLIError } from '@oclif/core/errors';
import { type ParserOutput } from '@oclif/core/interfaces';

import * as telemetry from '../../lib/telemetry.js';
import logger from '../../lib/logger.js';

const { warn } = logger('hook:finally:analytics');

type AxwayHookData = {
	parsed?: ParserOutput;
};

const hook: Hook.Finally = async function (opts: Parameters<Hook.Finally>[0] & { config: AxwayHookData }) {
	const { id, config } = opts;
	const error = opts.error as CLIError | undefined;

	try {
		const telemetryInstance = await telemetry.init({
			appGuid: '0049ef76-0557-4b83-985c-a1d29c280227',
			appVersion: opts.config.version,
			config
		});

		// Fall out if telemetry is disabled
		if (telemetryInstance.isTelemetryDisabled()) {
			return;
		}

		const eventData = {
			contexts: [ config.bin, ...(id || '').split(':') ].filter(Boolean),
			argv: config.parsed ? scrubParsedArgs(config.parsed) : redactArgv(opts.argv),
			exitCode: error?.oclif?.exit || process.exitCode || 0,
			duration: Math.round(Performance.oclifPerf['oclif.runMs'] || 0)
		};

		await telemetryInstance.addEvent({
			event: `telemetry.${eventData.contexts?.length > 1 ? [ 'cli', ...eventData.contexts.slice(1) ].join('.') : 'cli.exec'}`,
			...eventData
		});

		if (error) {
			const serialized = serializeError(error);
			await telemetry.addCrash({
				message: serialized.message || 'Unknown error',
				..._.pick(serialized, [ 'name', 'stack', 'code' ]),
				...eventData
			});
		}

		await telemetryInstance.send();
	} catch (err) {
		warn(err);
	}
};

export default hook;

/**
 * Redacts potentially sensitive command line args.
 *
 * @param {Array<Object>} argv - The parsed arguments.
 * @returns {Array<String>} - The redacted command line args.
 */
function scrubParsedArgs(parsed: ParserOutput): string[] {
	const scrubbed = [];
	for (const arg of parsed.raw) {
		if (arg.type === 'arg') {
			scrubbed.push(`<${arg.arg.toUpperCase()}>`);
		} else if (arg.type === 'flag') {
			scrubbed.push(`--${arg.flag}`);
			if (typeof parsed.flags[arg.flag] !== 'boolean') {
				scrubbed.push('<VALUE>');
			}
		}
	}
	return scrubbed;
}

/**
 * Redacts potentially sensitive command line args that haven't been parsed by oclif.
 *
 * @param {String[]} argv - The command line args.
 * @returns {String[]} - The redacted command line args.
 */
function redactArgv(argv: string[]): string[] {
	return argv.map((arg) => {
		// Redact anything that looks like a flag with a value
		if (/^--?\w[=-]/.test(arg)) {
			const [ flag, ...rest ] = arg.split('=');
			// If the flag has an equals sign, redact the value
			if (rest.length) {
				return `${flag}=<VALUE>`;
				// If the value starts with - but isn't a flag, redact the value
			} else if (flag.startsWith('-') && !flag.startsWith('--') && flag.length > 2) {
				return '<VALUE>';
			}
			// Otherwise just return the flag as-is
			return flag;
		}

		// Redact everything that does not look like a potential flag
		return '<VALUE>';
	});
}
