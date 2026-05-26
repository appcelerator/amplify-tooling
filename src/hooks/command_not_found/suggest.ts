import { type Hook, toConfiguredId, toStandardizedId } from '@oclif/core';
import { closest, distance } from 'fastest-levenshtein';
import { confirm } from '@inquirer/prompts';
import logger from '../../lib/logger.js';

const { warn } = logger('hook:command_not_found:suggestions');

const hook: Hook.CommandNotFound = async function ({ config, id, argv }) {
	// Oclif does not include a -v shorthand for the default version flag, so let's add one manually here.
	if (id === '-v' || argv?.includes('-v')) {
		return this.log(config.userAgent);
	}

	const closestCommand: string = closest(id, config.commandIDs);
	const dist = distance(id, closestCommand);
	if (dist > 3) {
		return this.error(`Command "${toConfiguredId(id, config)}" not found.`);
	}

	// Skip interactive prompt in non-TTY environments
	if (!process.stdin.isTTY && process.env.AXWAY_TEST !== '2') {
		let msg = `Command "${toConfiguredId(id, config)}" not found.`;
		if (closestCommand) {
			msg += ` Did you mean "${toConfiguredId(closestCommand, config)}"?`;
		}
		return this.error(msg);
	}

	warn('Unknown command detected, prompting for confirmation of closest match');

	let confirmed = true;
	try {
		confirmed = await confirm({
			message: `Did you mean "${toConfiguredId(closestCommand, config)}"? Command will execute in 5s...`,
			default: true
		}, {
			signal: AbortSignal.timeout(5000)
		});
	} catch (err) {
		if (err.name !== 'AbortPromptError') {
			confirmed = false;
		}
	}

	if (confirmed) {
		return config.runCommand(toStandardizedId(closestCommand, config), argv);
	}

	return this.error(`Command "${toConfiguredId(id, config)}" not found.`);
};

export default hook;
