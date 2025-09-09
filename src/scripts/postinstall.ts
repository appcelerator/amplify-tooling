import chalk from 'chalk';
import * as telemetry from '../lib/telemetry.js';

const { cyan, green, red } = chalk;
const telemetryEnabled = telemetry.isEnabled();

console.log(`
${green('Axway CLI successfully installed!')}

GETTING HELP:

  The Axway CLI has built-in help that can be accessed by passing ${cyan('--help')} into
  any command or by running:

    ${cyan('axway')}

  Visit the documentation for configuration and troubleshooting help:

    ${cyan('https://docs.axway.com/bundle/axwaycli-open-docs/page/docs/index.html')}

AUTHENTICATION:

  To log into the AMPLIFY Platform, run:

    ${cyan('axway auth login')}

  To create a service account, run:

    ${cyan('axway service-account create')}

ORGANIZATION, USER, AND TEAM MANAGEMENT:

  Once authenticated as a platform user, you may manage organizations, teams,
  and your user information using the following commands:

    ${cyan('axway org')}
    ${cyan('axway team')}
    ${cyan('axway user')}

TELEMETRY:

  The Axway CLI collects data which is used to improve our products. Telemetry
  is currently ${telemetryEnabled ? green('enabled') : red('disabled')}.

  ${telemetryEnabled ?
  `You can opt-out of telemetry by running:

     ${cyan('axway telemetry --disable')}` :

  `You can change your telemetry preference by running:
     ${cyan('axway telemetry --enable')}`}
`);
