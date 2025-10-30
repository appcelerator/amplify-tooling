import chalk from 'chalk';
import * as telemetry from '../lib/telemetry.js';

const { cyan, green, red } = chalk;

(async () => {
	const telemetryEnabled = await telemetry.isEnabled();
	console.log(`
${green('Axway CLI successfully installed!')}

GETTING HELP:

  The Axway CLI has built-in help that can be accessed by passing ${cyan('--help')} into
  any command or by running:

    ${cyan('axway')}

  Visit the documentation for configuration and troubleshooting help:

    ${cyan('https://docs.axway.com/bundle/axwaycli-open-docs/page/docs/index.html')}

AUTHENTICATION:

  To log into the Axway Platform, run:

    ${cyan('axway auth login')}

  To create a service account, run:

    ${cyan('axway service-account create')}

ORGANIZATION, AND TEAM MANAGEMENT:

  Once authenticated as a platform service account, you may manage organizations
  and teams using the following commands:

    ${cyan('axway org')}
    ${cyan('axway team')}

SHELL COMPLETION:

  To enable shell completion for the Axway CLI, run:

    ${cyan('axway completion --help')}

TELEMETRY:

  The Axway CLI collects data which is used to improve our products. Telemetry
  is currently ${telemetryEnabled ? green('enabled') : red('disabled')}.

  ${telemetryEnabled
		? `You can opt-out of telemetry by running:

     ${cyan('axway telemetry --disable')}`

		: `You can change your telemetry preference by running:
     ${cyan('axway telemetry --enable')}`}
`);
})();
