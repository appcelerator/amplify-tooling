import chalk from 'chalk';
import Debug from 'debug';

// Override debug's formatArgs to consistently use ISO string timestamps instead of ms diffs on TTY outputs
// Based on: https://github.com/debug-js/debug/blob/6b2c5fbdb7d414483d9e306ef234acb4cd7ea67c/src/node.js#L167-L180
Debug.formatArgs = formatArgs;
function formatArgs(args) {
	const { namespace: name, useColors } = this;

	if (useColors) {
		const c = this.color;
		const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
		const prefix = `${chalk.magenta(new Date().toISOString())} ${colorCode};1m${name} \u001B[0m`;

		args[0] = prefix + args[0].split('\n').join('\n' + prefix);
	} else {
		args[0] = new Date().toISOString() + ' ' + name + ' ' + args[0];
	}
}

export interface Logger {
	(...args: any[]): void;
	log: (...args: any[]) => void;
	debug: (...args: any[]) => void;
	info: (...args: any[]) => void;
	warn: (...args: any[]) => void;
	error: (...args: any[]) => void;
	fatal: (...args: any[]) => void;
}
/**
 * Create a logger instance.
 *
 * @param {String} namespace Namespace to use for the logger instance. Value is prefixed with `axway-cli:`.
 * @returns {Logger} Logger instance.
 */
export default function logger(namespace: string): Logger {
	const debug = Debug(`axway-cli:${namespace}`);

	function log(...args: any[]) {
		debug(...args);
	}

	log.log = function(...args: any[]) {
		debug(...args);
	}

	log.debug = function(...args: any[]) {
		debug(chalk.magenta('debug'), ...args);
	}

	log.error = function(...args: any[]) {
		debug(chalk.red('error'), ...args);
	};

	log.warn = function(...args: any[]) {
		debug(chalk.yellow('warn'), ...args);
	};

	log.info = function(...args: any[]) {
		debug(chalk.green('info'), ...args);
	};

	log.fatal = function(...args: any[]) {
		debug(chalk.white.bgRed('fatal'), ...args);
	};

	return log;
}

// Semantic aliases for chalk styles
export const active = chalk.green;
export const alert = chalk.red;
export const highlight = chalk.cyan;
export const lowlight = chalk.blue;
export const note = chalk.gray;
export const notice = chalk.yellow;
export const ok = chalk.green;

// Semantic aliases for CLI output formatting
export const heading = (text: string) => String(text || '').toUpperCase();
export const uppercase = (text: string) => String(text || '').toUpperCase();
export const lowercase = (text: string) => String(text || '').toLowerCase();
export const bracket = (text: string) => `[${String(text || '')}]`;
export const paren = (text: string) => `(${String(text || '')})`;
