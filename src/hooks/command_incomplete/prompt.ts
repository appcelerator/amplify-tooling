import { Hook, toConfiguredId, toStandardizedId } from '@oclif/core';
import { select } from '@inquirer/prompts';
import logger from '../../lib/logger.js';

const { warn } = logger('hook:command_incomplete:prompt');

const hook: Hook.CommandIncomplete = async function ({ config, matches, argv }) {
	warn('Incomplete command detected, prompting for selection');
	const command: string = await select({
		message: 'Which of these commands would you like to run?',
		choices: matches.map(p => toConfiguredId(p.id, config)),
	});

	if (argv.includes('--help') || argv.includes('-h')) {
		return config.runCommand('help', [ toStandardizedId(command, config) ]);
	}

	return config.runCommand(toStandardizedId(command, config), argv);
};

export default hook;
