import { expect } from 'chai';
import {
	renderRegex,
	resetHomeDir,
	runAxwaySync
} from './helpers';

describe('axway', () => {
	describe('help', () => {
		after(resetHomeDir);

		it('should output the help screen with color', async () => {
			const { status, stdout } = runAxwaySync();

			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegex(`{{#cyan}}AXWAY CLI{{/cyan}}, version {{version}}
Copyright (c) 2018-2021, Axway, Inc. All Rights Reserved.

The Axway CLI is a unified command line interface for the Axway Amplify platform.

USAGE: {{#cyan}}axway <command> [options]{{/cyan}}

COMMANDS:
  {{#cyan}}auth         {{/cyan}}  Authenticate machines with the Axway Amplify platform
  {{#cyan}}config       {{/cyan}}  Manage configuration options
  {{#cyan}}org          {{/cyan}}  Manage Amplify platform organizations
  {{#cyan}}pm           {{/cyan}}  Package manager for Axway products
  {{#cyan}}team         {{/cyan}}  Manage Amplify organization teams
  {{#cyan}}user         {{/cyan}}  Manage your user settings

GLOBAL OPTIONS:
  {{#cyan}}--no-banner  {{/cyan}}  Suppress the banner
  {{#cyan}}--no-color   {{/cyan}}  Disable colors
  {{#cyan}}-h, --help   {{/cyan}}  Displays the help screen
  {{#cyan}}-v, --version{{/cyan}}  Outputs the version
`));
		});

		it('should output the help screen without color', async () => {
			const { status, stdout } = runAxwaySync([ '--no-color' ]);

			expect(status).to.equal(2);
			expect(stdout.toString()).to.match(renderRegex(`AXWAY CLI, version {{version}}
Copyright (c) 2018-2021, Axway, Inc. All Rights Reserved.

The Axway CLI is a unified command line interface for the Axway Amplify platform.

USAGE: axway <command> [options]

COMMANDS:
  auth           Authenticate machines with the Axway Amplify platform
  config         Manage configuration options
  org            Manage Amplify platform organizations
  pm             Package manager for Axway products
  team           Manage Amplify organization teams
  user           Manage your user settings

GLOBAL OPTIONS:
  --no-banner    Suppress the banner
  --no-color     Disable colors
  -h, --help     Displays the help screen
  -v, --version  Outputs the version
`));
		});
	});
});
