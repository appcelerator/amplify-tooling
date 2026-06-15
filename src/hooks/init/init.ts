import { resolve } from 'path';

import chalk from 'chalk';
import { type Hook } from '@oclif/core';

import check from '../../lib/update.js';
import loadConfig, { Config } from '../../lib/config.js';
import logger, { highlight } from '../../lib/logger.js';
import { axwayHome } from '../../lib/path.js';
import { createRequestOptions } from '../../lib/request.js';

const { log, warn } = logger('hook:init:init');

const hook: Hook.Init = async function (opts) {
	process.env.AMPLIFY_CLI = opts.config.version;
	process.env.AXWAY_CLI = opts.config.version;

	let config: Config;

	try {
		config = await loadConfig();
	} catch (err) {
		warn(err);
		return this.error(err);
	}

	const hasStructuredOutput = opts.argv.some((arg, i) =>
		(arg === '-o' || arg === '--output') && (opts.argv[i + 1] === 'json' || opts.argv[i + 1] === 'yaml')
	);

	if (config.get('update.check') === false || opts.argv.includes('--no-banner') || opts.argv.includes('--json') || hasStructuredOutput) {
		log('Skipping update check');
	} else {
		// Trigger the update check fetch and let it continue asynchronously while the command runs
		check({
			...createRequestOptions({
				timeout: { request: 4000 }
			}, config),
			metaDir: resolve(axwayHome, 'axway-cli', 'update'),
			pkg: opts.config.pjson
		}).catch(() => {});
	}

	const command = opts.config.commands.find(cmd => cmd.id === opts.id);

	// Include the banner if not disabled
	if (config.get('banner.enabled') !== false
		// Not opted-out
		&& !opts.argv.includes('--no-banner')
		// Not requesting JSON output (oclif built-in or engage -o/--output flag)
		&& !opts.argv.includes('--json')
		&& !hasStructuredOutput
		// And for commands that do not have it disabled (other than for help output)
		&& (command?.enableBanner !== false || opts.argv.includes('--help'))
	) {
		const year = new Date(Date.now()).getFullYear().toString();
		const [ supportedNodeVersion ] = opts.config.pjson.engines.node?.match(/\d{2}/) || [ '22' ];
		let str = `${highlight('AXWAY CLI')}, version ${opts.config.version}
Copyright (c) 2018-${year}, Axway, Inc. All Rights Reserved.`;

		if (Number(process.versions.node.split('.')[0]) < Number(supportedNodeVersion)) {
			str += '\n\n' + chalk.yellow(` ┃ ATTENTION! Support for the Node.js version you are currently using (${process.version})
 ┃ has been deprecated and is unsupported in Axway CLI v5 and newer. Please upgrade
 ┃ Node.js to the latest LTS release: https://nodejs.org/`);
		}
		this.log(str + '\n');
	}
};

export default hook;
