import { Flags } from '@oclif/core';

/**
 * Common flags shared across all Engage commands.
 * Spread into a command's `flags` definition to include them all:
 *   static override flags = { ...commonFlags, ... }
 */
export const commonFlags = {
	useCache: Flags.boolean({
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
