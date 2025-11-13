import { type Hook, toConfiguredId, toStandardizedId } from '@oclif/core';
import { closest, distance } from 'fastest-levenshtein';
import { confirm } from '@inquirer/prompts';
import logger from '../../lib/logger.js';

const { warn } = logger('hook:command_not_found:suggestions');

const hook: Hook.CommandNotFound = async function ({ config, id, argv }) {
	const closestCommand: string = closest(id, config.commandIDs);
	const dist = distance(id, closestCommand);
	if (dist > 3) {
		return this.error(`Command "${toConfiguredId(id, config)}" not found.`);
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
