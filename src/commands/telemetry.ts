import * as telemetry from '../lib/telemetry.js';
import Command from '../lib/command.js';
import chalk from 'chalk';
import { Flags } from '@oclif/core';
import { highlight } from '../lib/logger.js';
import { confirm } from '@inquirer/prompts';

export default class TelemetryCommand extends Command {
	static override summary = 'Opt-in or out of telemetry to improve Axway products.';

	static override description = `The Axway CLI has a telemetry system that collects anonymous data which is used
to improve Axway products. We use this data to determine product roadmaps,
feature deprecations, and crash reporting.

Data collected includes your operating system, CPU architecture, Node.js
version, Axway CLI version, installed CLI extensions, command invoked, and
randomly generated machine and session ids. Sensitive information including
your username, email address, and paths are redacted.

Axway does not collect your personal information, link your activity to your
Axway account, capture environment variables, or unique machine identifiers
such as the MAC address or serial number.

You may opt-out of telemetry by running ${highlight('axway telemetry --disable')} or setting
the environment variable ${highlight('AXWAY_TELEMETRY_DISABLED')} to ${highlight('1')}.`;

	static override flags = {
		enable: Flags.boolean({ description: 'Enables data collection' }),
		disable: Flags.boolean({ description: 'Disables data collection and deletes any pending telemetry data' }),
	};

	static override authenticated = false;
	static override enableJsonFlag = true;
	static override enableProfileFlag = false;

	async run(): Promise<void | object> {
		const { config, flags } = await this.parse(TelemetryCommand);
		let enabled = await telemetry.isEnabled();

		if (flags.enable && !flags.disable) {
			enabled = true;
		} else if (!flags.enable && flags.disable) {
			enabled = false;
		} else {
			if (this.jsonEnabled()) {
				return {
					description: TelemetryCommand.description,
					enabled,
				};
			}
			this.log(TelemetryCommand.description);
			this.log(`\nTelemetry is currently ${enabled ? chalk.green('enabled') : chalk.red('disabled')}\n`);

			if (enabled) {
				this.log('Note: Disabling telemetry will delete any pending telemetry data.\n');
			}

			if ((process.stdin.isTTY)) {
				enabled = await confirm({
					message: 'Do you want to enable telemetry?',
					default: false
				});
			}
		}

		config.set('telemetry.enabled', enabled);
		config.save();

		if (this.jsonEnabled()) {
			return {
				enabled,
				status: enabled ? 'enabled' : 'disabled',
				message: enabled
					? 'Telemetry has been enabled. Thank you for helping Axway!'
					: 'Telemetry has been disabled and the telemetry data directory has been deleted.',
			};
		}

		if (enabled) {
			this.log(`Telemetry has been ${chalk.green('enabled')}.\n`);
			this.log('Thank you for helping Axway!');
		} else {
			telemetry.nukeData();
			this.log(`Telemetry has been ${chalk.red('disabled')} and the telemetry data directory has been deleted.`);
		}
	}
}
