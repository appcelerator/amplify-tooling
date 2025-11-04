import boxen from 'boxen';
import chalk from 'chalk';
import { Hook } from '@oclif/core';

import check from '../../lib/update.js';
import { loadConfig } from '../../lib/config.js';

const hook: Hook.Finally = async function (opts) {
	const config = await loadConfig();

	// If update checks are disabled or --json or --no-banner is present, fall out now
	if (config.get('update.check') === false || opts.argv.includes('--json') || opts.argv.includes('--no-banner')) {
		return;
	}

	// Await the update check that was started in the init hook
	const result = await check({});

	// If an update is available, and there is no --no-banner or --json flag, show the notification
	if (result?.updateAvailable && !opts.argv.includes('--no-banner') && !opts.argv.includes('--json')) {
		let msg = '';
		const ts = config.get('update.notified');

		// only show update notifications once every hour
		if (ts && (Date.now() - ts) < 3600000) {
			return;
		}
		// Record the time we showed the notification in the config and save it
		config.set('update.notified', Date.now());
		config.save();

		msg += chalk.yellow('Axway CLI Update Available'.toUpperCase()) + '\n';
		msg += `${chalk.bold('Axway CLI')} ${chalk.gray(result.current)} →  ${_hlVer(result.latest, result.current)}\n`;
		msg += `Run ${chalk.cyan('npm i -g axway')} to update`;

		this.log('\n' + boxen(msg, {
			align: 'center',
			borderColor: 'yellow',
			borderStyle: 'round',
			margin: { bottom: 1, left: 4, right: 4, top: 1 },
			padding: { bottom: 1, left: 4, right: 4, top: 1 }
		}));
	}
};

export default hook;

/**
 * Highlights the difference between two versions.
 *
 * @param {String} toVer - The latest version.
 * @param {String} fromVer - The current version.
 * @returns {String}
 */
function _hlVer(toVer, fromVer) {
	const version = [];

	// eslint-disable-next-line prefer-const
	let [ from, fromTag ] = fromVer.split(/-(.+)/);
	from = from.replace(/[^.\d]/g, '').split('.').map(x => parseInt(x));

	// eslint-disable-next-line prefer-const
	let [ to, toTag ] = toVer.split(/-(.+)/);
	const toMatch = to.match(/^([^\d]+)?(.+)$/);
	to = (toMatch ? toMatch[2] : to).split('.').map(x => parseInt(x));

	const tag = () => {
		if (toTag) {
			const toNum = toTag.match(/\d+$/);
			const fromNum = fromTag && fromTag.match(/\d+$/);
			if (fromNum && parseInt(fromNum[0]) >= parseInt(toNum)) {
				return `-${toTag}`;
			} else {
				return chalk.green(`-${toTag}`);
			}
		}
		return '';
	};

	while (to.length) {
		if (to[0] > from[0]) {
			if (version.length) {
				return (toMatch && toMatch[1] || '') + version.concat(chalk.green(to.join('.') + tag())).join('.');
			}
			return chalk.green((toMatch && toMatch[1] || '') + to.join('.') + tag());
		}
		version.push(to.shift());
		from.shift();
	}

	return (toMatch && toMatch[1] || '') + version.join('.') + tag();
}
