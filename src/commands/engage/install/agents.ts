import Command from '../../../lib/command.js';
import { commonFlags } from '../../../lib/engage/flags.js';
import Renderer from '../../../lib/engage/results/renderer.js';
import { installAgents } from '../../../lib/engage/services/install-service.js';
import { highlight } from '../../../lib/logger.js';

export class EngageInstallAgentsCommand extends Command {
	static override summary = 'Amplify API Gateway / Apigee X Gateway / Amazon API Gateway / Azure API Gateway / Azure EventHub / Backstage / GitLab / Istio / Kafka /'
		+ ' Graylog / IBM API Connect / SwaggerHub / Software AG WebMethods / Traceable / SAP API Portal / Sensedia / WSO2';

	static override aliases = [ 'central:install:agents' ];

	static override description = `You must be authenticated to install agents.
                Run ${highlight('"axway auth login"')} to authenticate.`;

	static override flags = {
		...commonFlags,
	};

	async run(): Promise<void> {
		let renderer = new Renderer(console, undefined);
		try {
			const { account, flags } = await this.parse(EngageInstallAgentsCommand);
			renderer = new Renderer(console, flags.output);
			await installAgents({ account, baseUrl: flags.baseUrl, apicDeployment: flags.apicDeployment, useCache: flags.useCache, axwayManaged: flags.axwayManaged });
		} catch (err: any) {
			renderer.anyError(err);
			process.exit(1);
		}
		process.exit(0);
	}
}
