import { Flags } from '@oclif/core';

/**
 * Common flags shared across all Engage commands.
 * Spread into a command's `flags` definition to include them all:
 *   static override flags = { ...commonFlags, ... }
 */
export const commonFlags = {
	account: Flags.string({
		description: 'Override your default account config',
	}),
	region: Flags.string({
		description: 'Override your region config',
	}),
	cache: Flags.boolean({
		description: 'Use cache when communicating with the server',
		allowNo: true,
		default: true,
	}),
	baseUrl: Flags.string({
		hidden: true,
	}),
	apicDeployment: Flags.string({
		hidden: true,
	}),
	axwayManaged: Flags.boolean({
		hidden: true,
	}),
};
