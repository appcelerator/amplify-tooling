/**
 * @description Values to provide to the gitLab templates.
 */

import { CentralAgentConfig } from '../../../types.js';

export class GitLabAgentValues {
	token: string;
	baseURL: string;
	repositoryID: string;
	repositoryBranch: string;
	paths: string[];
	filters: string[];
	daQueueName: string;
	daVersion: string;
	centralConfig: CentralAgentConfig;

	constructor() {
		this.token = '';
		this.baseURL = '';
		this.repositoryID = '';
		this.repositoryBranch = '';
		this.daQueueName = '';
		this.daVersion = '';
		this.paths = [];
		this.filters = [];
		this.centralConfig = new CentralAgentConfig();
	}
}

export const gitLabDAEnvVarTemplate = () => {
	return `# GitLab configs
GITLAB_TOKEN={{token}}
GITLAB_BASE_URL={{baseURL}}
GITLAB_REPOSITORY_ID={{repositoryID}}
GITLAB_REPOSITORY_BRANCH={{repositoryBranch}}
GITLAB_REPOSITORY_SPEC_PATHS={{paths}}
GITLAB_REPOSITORY_SPEC_FILTERS={{filters}}

# Amplify Central configs
CENTRAL_AGENTNAME={{centralConfig.daAgentName}}
CENTRAL_AUTH_CLIENTID={{centralConfig.dosaAccount.clientId}}
CENTRAL_AUTH_PRIVATEKEY={{centralConfig.dosaAccount.templatePrivateKey}}
CENTRAL_AUTH_PUBLICKEY={{centralConfig.dosaAccount.templatePublicKey}}
CENTRAL_ENVIRONMENT={{centralConfig.environment}}
CENTRAL_ORGANIZATIONID={{centralConfig.orgId}}
{{#compare . centralConfig.ampcTeamName "" operator="!=" }}
CENTRAL_TEAM={{centralConfig.ampcTeamName}}
{{/compare}}
CENTRAL_REGION={{centralConfig.region}}

# Logging configs
# Define the logging level: info, debug, error
LOG_LEVEL=info
# Specify where to send the log: stdout, file, both
LOG_OUTPUT=stdout
# Define where the log files are written
LOG_FILE_PATH=logs
`;
};
