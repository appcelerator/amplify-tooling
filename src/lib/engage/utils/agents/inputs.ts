import chalk from 'chalk';
import inquirer from 'inquirer';
import { askInput, askList, runValidations, validateInputIsNew, validateRegex } from '../basic-prompts.js';
import { ApiServerClient } from '../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../results/DefinitionsManager.js';
import { AgentTypes, EnvironmentConfigInfo, GenericResource } from '../../types.js';
import { invalidResourceMsg, resourceRegex } from '../regex.js';

export const envMessages = {
	createNewEnvironment: 'Create a new environment',
	enterEnvironmentName: 'Enter a new environment name',
	isProduction: 'Is the environment used for production purpose?',
	selectEnvironment: 'Select an environment',
	selectReferencedEnvironment: 'Select a referenced environment',
	selectMoreWithExistingRefEnv: 'Selected environment already contains references, do you want to select more',
	selectMoreRefEnv: 'Do you want to select more referenced environment',
	getEnvironmentsError: 'Get environments error.',
	environmentAlreadyExists: 'Environment already exists. Please enter a new name.',
	selectTeam: 'Select a team',
};

export const agentMessages = {
	enterDiscoveryAgentName: 'Enter a new discovery agent name',
	enterTraceabilityAgentName: 'Enter a new traceability agent name',
	enterComplianceAgentName: 'Enter a new compliance agent name',
	getAgentsError: 'Error getting agents.',
	agentAlreadyExists: 'Agent already exists. Please enter a new name.',
	selectAgentType: 'Select the type of agent(s) you want to install',
};

const cliNowString = `cli-${Date.now()}`;

export const askEnvironmentName = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	isAxwayManaged: boolean | null = null,
	gatewayType?: string
): Promise<EnvironmentConfigInfo> => {
	let envs: GenericResource[];
	const envDef = defsManager.findDefsByKind('Environment')[0];
	if (isAxwayManaged === null) {
		// do not filter any environments
		const { data: allEnvs } = await client.getResourcesList({
			resourceDef: envDef.resource,
		});
		if (!allEnvs) {
			throw Error(envMessages.getEnvironmentsError);
		}
		envs = allEnvs;
	} else {
		// Get only the axway managed environments
		const { data: axwayManagedEnvs } = await client.getResourcesList({
			resourceDef: envDef.resource,
			query: 'spec.axwayManaged==true',
		});
		if (!axwayManagedEnvs) {
			throw Error(envMessages.getEnvironmentsError);
		}
		envs = axwayManagedEnvs;
		if (!isAxwayManaged) {
			const { data: allEnvs } = await client.getResourcesList({
				resourceDef: envDef.resource,
			});
			if (!allEnvs) {
				throw Error(envMessages.getEnvironmentsError);
			}

			// Remove any axway managed envs from the array when isAxwayManaged is false
			envs = allEnvs.filter((env) => {
				return !envs.find((axwayManagedEnv) => env.name === axwayManagedEnv.name);
			});
		}
	}

	const answer = await askList({
		msg: envMessages.selectEnvironment,
		choices: [
			{ name: envMessages.createNewEnvironment, value: 'CREATE_NEW' },
			new inquirer.Separator(),
			...envs.map((e) => e.name).sort((name1, name2) => name1.localeCompare(name2)),
			new inquirer.Separator(),
		],
	});
	if (answer === 'CREATE_NEW') {
		const name = (await askInput({
			msg: envMessages.enterEnvironmentName,
			defaultValue: cliNowString,
			validate: runValidations(
				validateInputIsNew(
					envs.map((env) => env.name),
					envMessages.environmentAlreadyExists
				),
				validateRegex(resourceRegex, invalidResourceMsg('Environment'))
			),
		})) as string;
		return { name, isNew: true } as EnvironmentConfigInfo;
	} else {
		// Check if user is installing Traceable agent and there's only 1 existing environment - exit gracefully
		if (gatewayType === 'Traceable' && envs.length === 1) {
			console.log(chalk.yellow('Warning: The Traceable agent requires at least one Engage environment before installing.'));
			console.log(chalk.gray('Installation cancelled. You can create more environments using: axway engage create environment'));
			process.exit(0);
		}
		const selectedEnv = envs.find((env) => env.name === answer);
		return {
			name: answer,
			isNew: false,
			referencedEnvironments: selectedEnv?.references?.managedEnvironments ? selectedEnv?.references?.managedEnvironments : [],
			referencedIdentityProviders: selectedEnv?.references?.identityProviders ? selectedEnv?.references?.identityProviders : [],
		} as EnvironmentConfigInfo;
	}
};

export const askAgentName = async (
	client: ApiServerClient,
	defsManager: DefinitionsManager,
	agentType: AgentTypes,
	scopeName: string
): Promise<string> => {
	let resourceType;
	let msg;
	switch (agentType) {
		case AgentTypes.da: {
			resourceType = 'DiscoveryAgent';
			msg = agentMessages.enterDiscoveryAgentName;
			break;
		}
		case AgentTypes.ta: {
			resourceType = 'TraceabilityAgent';
			msg = agentMessages.enterTraceabilityAgentName;
			break;
		}
		case AgentTypes.ca: {
			resourceType = 'ComplianceAgent';
			msg = agentMessages.enterComplianceAgentName;
			break;
		}
	}

	const resourceDef = defsManager.findDefsByKind(resourceType)[0];
	let { data: agents } = await client.getResourcesList({ resourceDef: resourceDef.resource, scopeDef: resourceDef.scope, scopeName });
	// if there are no agents scoped to the env, make the agents list blank to validate against
	agents = agents ?? [];

	const name = (await askInput({
		msg: msg,
		defaultValue: cliNowString,
		validate: runValidations(
			validateInputIsNew(
				agents.map((a) => a.name),
				agentMessages.agentAlreadyExists
			),
			validateRegex(resourceRegex, invalidResourceMsg(resourceType))
		),
	})) as string;
	return name;
};
