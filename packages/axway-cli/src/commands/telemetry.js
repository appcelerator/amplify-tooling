import snooplogg from 'snooplogg';
import { loadConfig, telemetry } from '@axway/amplify-cli-utils';

export default {
	desc: 'Opt-in or out of telemetry to improve Axway products',
	extendedDesc: `The Axway CLI has a telemetry system that collects anonymous data which is used
to improve Axway products. We use this data to determine product roadmaps,
feature deprecations, and crash reporting.

Data collected includes your operating system, CPU architecture, Node.js
version, Axway CLI version, installed CLI extensions, command invoked, and
randomly generated machine and session ids. Sensitive information including
your username, email address, and paths are redacted.

Axway does not collect your personal information, link your activity to your
Axway account, capture environment variables, or unique machine identifiers
such as the MAC address or serial number.`,
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer({ style }) {
			return `${this.extendedDesc}

You may opt-out of telemetry by running ${style.highlight('axway telemetry --disable')} or setting
the environment variable ${style.highlight('AXWAY_TELEMETRY_DISABLED')} to ${style.highlight('1')}.`;
		}
	},
	options: {
		'--enable': 'Enables data collection',
		'--disable': 'Disabled data collection and deletes any pending telemetry data'
	},
	async action({ argv, console, terminal }) {
		const { green, red } = snooplogg.default.styles;
		const config = await loadConfig();
		let enabled = telemetry.isEnabled();

		if (argv.enable && !argv.disable) {
			enabled = true;
		} else if (!argv.enable && argv.disable) {
			enabled = false;
		} else {
			console.log(this.extendedDesc);
			console.log(`\nTelemetry is currently ${enabled ? green('enabled') : red('disabled')}\n`);

			if (enabled) {
				console.log('Note: Disabling telemetry will delete any pending telemetry data.\n');
			}

			if (terminal.stdout.isTTY) {
				enabled = await new Promise(resolve => {
					terminal.once('keypress', str => {
						terminal.stderr.cursorTo(0);
						terminal.stderr.clearLine();
						return resolve(str === 'y' || str === 'Y');
					});
					terminal.stderr.write('Do you want to enable telemetry? (y/N) ');
				});
			}
		}

		await config.set('telemetry.enabled', enabled);
		await config.save();

		if (enabled) {
			console.log(`Telemetry has been ${green('enabled')}.\n`);
			console.log('Thank you for helping Axway!');
		} else {
			telemetry.nukeData();
			console.log(`Telemetry has been ${red('disabled')} and the telemetry data directory has been deleted.`);
		}
	}
};
