import fs from 'fs-extra';
import loadConfig from '@axway/amplify-config';
import path from 'path';
import snooplogg from 'snooplogg';
import { ansi } from 'cli-kit';
import { spawnSync } from 'child_process';

const { alert, highlight } = snooplogg.styles;
const { error, log } = snooplogg('pm:utils');

/**
 * Cached user agent.
 * @type {String}
 */
let userAgent;

/**
 * Returns the registry URL from the config.
 *
 * @param {String} env - The environment name to use. Possible values are "prod", "preprod", or
 * "dev".
 * @returns {Object}
 */
export function getRegistryParams(env) {
	const config = loadConfig();
	return {
		env: env || config.get('env') || 'prod',
		headers: {
			'User-Agent': buildUserAgentString()
		},
		url: config.get('registry.url')
	};
}

/**
 * Convert an error thrown by the `fetchAndInstall` function into something
 * human readable/actionable.
 *
 * @param {Error} err - Error object to inspect.
 * @returns {Error} The original error object.
 */
export function formatError(err) {
	err.exitCode = 1;

	switch (err.code) {
		case 'ECONNREFUSED':
			err.message = 'Unable to connect to registry server';
			err.exitCode = 3;
			break;
		case 'EINVALIDIR':
			err.message = `You are in an invalid directory to install this component type\n${err.message}`;
			break;
		case 'ENPMINSTALLERROR':
			// TODO: Need to break this error down into some sort of actionable items
			err.message = `An error occurred when running "npm install"\n${err.stack}`;
			break;
		case 'NO_DATA':
			err.message = 'No results found';
			break;
	}

	return err;
}

/**
 * Handles error formatting and outputting. Sets the `process.exitCode` to error.
 *
 * @param {Object} opts - Various options.
 * @param {Console} opts.console - A console object instance.
 * @param {Error} opts.err - The error object.
 * @param {Boolean} [opts.json] - When `true`, outputs the error as JSON.
 * @param {Function} [opts.outputError] - A function to output the main error message.
 */
export function handleError({ console, err, json, outputError }) {
	err = formatError(err);
	process.exitCode = err.exitCode || 1;

	error(err);
	if (err.detail) {
		error(err.detail);
	}

	if (json) {
		console.error(JSON.stringify({
			error: {
				message: err.toString(),
				detail: err.detail && ansi.strip(err.detail),
				code: err.code,
			}
		}, null, 2));
	} else {
		if (outputError) {
			outputError(err.toString());
		} else {
			console.error(alert(`${process.platform === 'win32' ? 'x' : '✖'} ${err.toString()}`));
		}
		if (err.detail) {
			console.error(`\n${err.detail}`);
		}
	}
}

/**
 * Creates the user agent if it's not already cached.
 *
 * @returns {String}
 */
export function buildUserAgentString() {
	if (userAgent) {
		return userAgent;
	}

	if (process.env.AMPLIFY_CLI) {
		return userAgent = `AMPLIFY-CLI/${process.env.AMPLIFY_CLI} AMPLIFY-CLI-PM/${require('../package.json').version}`;
	}

	return userAgent = `AMPLIFY-CLI-PM/${require('../package.json').version}`;
}

/**
 * Uninstalls a package.
 *
 * @param {String} dir - Path to the package to delete.
 * @returns {Promise}
 */
export async function uninstallPackage(dir) {
	try {
		const pkgJson = require(path.join(dir, 'package.json'));
		if (pkgJson.scripts.uninstall) {
			log(`Running npm uninstall script: ${highlight(pkgJson.scripts.uninstall)}`);
			const { status, stderr } = spawnSync('npm', [ 'run', 'uninstall' ], { cwd: dir });
			if (status) {
				error(alert('Failed to run npm uninstall script:'));
				error(stderr);
			}
		}
	} catch (e) {
		// squelch
	}

	await fs.remove(dir);
}
