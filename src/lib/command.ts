import { Command, type Config as OclifConfig, Flags, loadHelpClass } from '@oclif/core';
import loadConfig, { type Config } from './config.js';
import { initSDK } from './amplify-sdk/index.js';

import type AmplifySDK from './amplify-sdk/index.js';

import type { FlagInput, ParserOutput } from '@oclif/core/interfaces';

interface AxwayParserOutput extends ParserOutput {
	config: Config;
	sdk?: AmplifySDK;
	account?: Awaited<ReturnType<AmplifySDK['auth']['find']>>;
	org?: Awaited<ReturnType<AmplifySDK['org']['find']>>;
}

/**
 * Oclif does not let you dynamically define flags based on command properties
 * (despite doing it itself for the json flag via enableJsonFlag), so we define
 * authenticatedFlags here and add them in the "flags" init hook if the command
 * requires authentication.
 *
 * @see /src/hooks/init/flags.ts
 */
export const authenticatedFlags = {
	account: Flags.string({
		description: 'The account to use within the active profile.',
		required: false
	})
}

export default abstract class AxwayCommand extends Command {
	declare config: OclifConfig & { parsed?: ParserOutput };

	static override baseFlags: FlagInput = {
		...Command.baseFlags,
		'no-banner': Flags.boolean({
			description: 'Disable the banner.',
			default: false,
			helpGroup: 'GLOBAL'
		}),
		'no-color': Flags.boolean({
			description: 'Disable color output.',
			default: false,
			helpGroup: 'GLOBAL'
		}),
		profile: Flags.string({
			description: 'Specify the configuration profile to use.',
			helpGroup: 'GLOBAL'
		})
	};

	/**
	 * Whether authentication is required to run this command.
	 * Defaults to true.
	 */
	static authenticated: boolean = true;

	/**
	 * Whether this command should exclude the profile flag. Should only be set
	 * to true for commands that manage profiles themselves.
	 * Defaults to false.
	 */
	static enableProfileFlag: boolean = true;

	override async parse(options = this.ctor as any): Promise<AxwayParserOutput> {
		const parsed = await super.parse(options);
		// Store the parsed result on the config so it can be accessed in the `finally` hooks.
		this.config.parsed = parsed;

		const data = parsed as AxwayParserOutput;

		// Load the config, applying the profile if specified.
		data.config = await loadConfig();
		if (options.enableProfileFlag) {
			data.config.profile = parsed.flags.profile;
		}

		if (options.authenticated) {
			data.sdk = await initSDK();

			data.account = await data.sdk.auth.find(parsed.args?.accountName || parsed.flags?.account || data.config.get('auth.defaultAccount'));
			if (!data.account) {
				return this.error(`You must be authenticated\n\nTo login, run: ${this.config.bin} auth login`);
			}

			data.org = await data.sdk.org.find(data.account, parsed.args?.org || parsed.flags?.org);
		}

		// Return the parsed result along with the loaded config instance.
		return data;
	}

	/**
	 * Log command help output to stdout
	 */
	async help() {
		const Help = await loadHelpClass(this.config);
		const help = new Help(this.config);
		await help.showHelp(this.id.split(':'));
	}
}
