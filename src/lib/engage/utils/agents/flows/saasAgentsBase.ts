import chalk from 'chalk';
import * as crypto from 'crypto';
import { ApiServerClient } from '../../../clients-external/apiserverclient.js';
import { DefinitionsManager } from '../../../results/DefinitionsManager.js';
import { validateFrequency } from '../../../services/install-service.js';
import { AgentInstallConfig, AgentResourceKind, AgentTypes, CentralAgentConfig, GatewayTypeToDataPlane, GatewayTypes, GenericResource, IDPAuthConfiguration, YesNo, YesNoChoices } from '../../../types.js';
import { askInput, askList, validateRegex, validateValidRegex } from '../../basic-prompts.js';
import { FormatString } from '../../utils.js';
import * as helpers from '../index.js';

export class DataplaneConfig {
	type: string;

	constructor(type?: string) {
		this.type = type || '';
	}
}

export class Sanitize {
	keyMatch: string;
	valueMatch: string;

	constructor(k: string, m: string) {
		this.keyMatch = k;
		this.valueMatch = m;
	}
}

export class RedactionSet {
	show: string[];
	sanitize: Sanitize[];

	constructor() {
		this.show = [];
		this.sanitize = [];
	}
}

export class Redaction {
	maskingCharacter: string;
	path: string[];
	queryArgument: RedactionSet;
	requestHeaders: RedactionSet;
	responseHeaders: RedactionSet;

	constructor() {
		this.maskingCharacter = '{*}';
		this.path = [];
		this.queryArgument = new RedactionSet();
		this.requestHeaders = new RedactionSet();
		this.responseHeaders = new RedactionSet();
	}
}

export class Sampling {
	onlyErrors: boolean;

	constructor() {
		this.onlyErrors = true;
	}
}

export class SaasAgentValues {
	frequencyDA: string;
	queueDA: boolean;
	filterDA: string;
	frequencyTA: string;
	sampling: Sampling;
	redaction: Redaction;
	dataplaneConfig: DataplaneConfig;
	centralConfig: CentralAgentConfig;

	constructor() {
		this.frequencyDA = '';
		this.queueDA = false;
		this.filterDA = '';
		this.frequencyTA = '';
		this.sampling = new Sampling();
		this.redaction = new Redaction();
		this.dataplaneConfig = new DataplaneConfig();
		this.centralConfig = new CentralAgentConfig();
	}

	getAccessData(): string {
		return '';
	}
}

export const SharedSaasPrompts = {
	DA_FREQUENCY: 'How often should the discovery run, leave blank for integrating in CI/CD process',
	DA_FILTER: 'Please enter the filter conditions for discovery of API Services based on tags',
	TA_FREQUENCY: 'How often should the traffic collection run, leave blank for manual trigger only',
	QUEUE: 'Do you want to discover immediately after installation',
	REDACT_SHOW: 'Enter a regular expression for {0}s that may be shown',
	ENTER_SANITIZE_RULE: 'Do you want to add sanitization rules for {0}s',
	SANITIZE_KEY: 'Enter a regular expression for {0} keys that values should be sanitized',
	SANITIZE_VAL: 'Enter a regular expression for sanitization of values when matching a {0} key',
	MASKING_CHARS: 'Enter the characters to use when sanitizing a value',
	ENTER_MORE: 'Do you want to enter another {0} for {1}',
};

export const askForRedactionSet = async (setting: string, redactionSet: RedactionSet): Promise<RedactionSet> => {
	let askShow = true;
	console.log(chalk.gray(FormatString('\nRedaction settings for {0}s', setting)));
	while (askShow) {
		const input = (await askInput({
			msg: FormatString(SharedSaasPrompts.REDACT_SHOW, setting),
			defaultValue: '.*',
			validate: validateValidRegex(),
		})) as string;
		redactionSet.show.push(input);

		askShow = (await askList({
			msg: FormatString(SharedSaasPrompts.ENTER_MORE, 'redaction regular expression', setting),
			default: YesNo.No,
			choices: YesNoChoices,
		})) === YesNo.Yes;
	}

	console.log(chalk.gray(FormatString('Sanitization settings for {0}s', setting)));
	let askSanitize = (await askList({
		msg: FormatString(SharedSaasPrompts.ENTER_SANITIZE_RULE, setting),
		default: YesNo.No,
		choices: YesNoChoices,
	})) === YesNo.Yes;
	console.log(
		chalk.gray(
			'When a match for the key regular expression is found, a match\nfor the value regular expression will be replaced by the masking character(s)'
		)
	);
	while (askSanitize) {
		const keyMatch = (await askInput({
			msg: FormatString(SharedSaasPrompts.SANITIZE_KEY, setting),
			allowEmptyInput: true,
			validate: validateValidRegex(),
		})) as string;
		const valMatch = (await askInput({
			msg: FormatString(SharedSaasPrompts.SANITIZE_VAL, setting),
			allowEmptyInput: true,
			validate: validateValidRegex(),
		})) as string;

		if (keyMatch === '' || valMatch === '') {
			console.log('can\'t add sanitization rule with an empty key or value regular expression');
		} else {
			redactionSet.sanitize.push(new Sanitize(keyMatch, valMatch));
		}

		askSanitize = (await askList({
			msg: FormatString(SharedSaasPrompts.ENTER_MORE, 'sanitization rule', setting),
			default: YesNo.No,
			choices: YesNoChoices,
		})) === YesNo.Yes;
	}

	return redactionSet;
};

export const askForRedaction = async (agentValues: SaasAgentValues): Promise<SaasAgentValues> => {
	console.log(chalk.gray('\nRedaction and Sanitization settings'));
	let askPaths = true;
	console.log(chalk.gray('\nRedaction settings for URL paths'));
	while (askPaths) {
		const input = (await askInput({
			msg: FormatString(SharedSaasPrompts.REDACT_SHOW, 'URL path'),
			defaultValue: '.*',
			validate: validateValidRegex(),
		})) as string;
		agentValues.redaction.path.push(input);

		askPaths = (await askList({
			msg: FormatString(SharedSaasPrompts.ENTER_MORE, 'redaction regular expression', 'URL path'),
			default: YesNo.No,
			choices: YesNoChoices,
		})) === YesNo.Yes;
	}

	agentValues.redaction.queryArgument = await askForRedactionSet('query argument', agentValues.redaction.queryArgument);
	agentValues.redaction.requestHeaders = await askForRedactionSet('request header', agentValues.redaction.requestHeaders);
	agentValues.redaction.responseHeaders = await askForRedactionSet('response header', agentValues.redaction.responseHeaders);

	agentValues.redaction.maskingCharacter = (await askInput({
		msg: SharedSaasPrompts.MASKING_CHARS,
		defaultValue: '{*}',
		validate: validateRegex(helpers.maskingRegex, 'Please enter a valid value'),
	})) as string;

	return agentValues;
};

export const askFrequencyAndFilter = async (agentValues: SaasAgentValues, installConfig: AgentInstallConfig): Promise<SaasAgentValues> => {
	console.log(
		chalk.gray(
			'\n00d00h00m format, where 30m = 30 minutes, 1h = 1 hour, 7d = 7 days, and 7d1h30m = 7 days 1 hour and 30 minutes. Minimum of 30m.'
		)
	);
	agentValues.frequencyDA = (await askInput({
		msg: SharedSaasPrompts.DA_FREQUENCY,
		validate: validateFrequency(),
		allowEmptyInput: true,
	})) as string;

	agentValues.queueDA = ((await askList({
		msg: SharedSaasPrompts.QUEUE,
		default: YesNo.No,
		choices: YesNoChoices,
	})) as YesNo) === YesNo.Yes;

	agentValues.filterDA = (await askInput({
		msg: SharedSaasPrompts.DA_FILTER,
		allowEmptyInput: true,
	})) as string;

	if (installConfig.switches.isTaEnabled) {
		console.log(
			chalk.gray(
				'\n00d00h00m format, where 30m = 30 minutes, 1h = 1 hour, 7d = 7 days, and 7d1h30m = 7 days 1 hour and 30 minutes. Minimum of 30m.'
			)
		);
		agentValues.frequencyTA = (await askInput({
			msg: SharedSaasPrompts.TA_FREQUENCY,
			defaultValue: '30m',
			validate: validateFrequency(),
			allowEmptyInput: true,
		})) as string;

		agentValues = await askForRedaction(agentValues);
	}

	return agentValues;
};

export const createEncryptedAccessData = async (
	agentValues: SaasAgentValues | IDPAuthConfiguration,
	dataplaneRes: GenericResource
): Promise<string> => {
	const key = dataplaneRes.security?.encryptionKey || '';
	const hash = dataplaneRes.security?.encryptionHash || '';

	if (key === '' || hash === '') {
		throw Error('cannot encrypt access data as the encryption key info was incomplete');
	}

	const encData = crypto.publicEncrypt(
		{
			key: key,
			padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			oaepHash: hash,
		},
		Buffer.from(agentValues.getAccessData())
	);

	return encData.toString('base64');
};

type WrappedCleanupFunc = () => Promise<void>;

export const cleanResources = async (cleanupFuncs: WrappedCleanupFunc[]): Promise<void> => {
	for (let i = cleanupFuncs.length - 1; i >= 0; i--) {
		await cleanupFuncs[i]();
	}
};

export interface CompleteInstallContext {
	installConfig: AgentInstallConfig;
	agentValues: SaasAgentValues;
	apiServerClient: ApiServerClient;
	defsManager: DefinitionsManager;
	resourceFuncsForCleanup: WrappedCleanupFunc[];
	referencedIDPs: { name: string | undefined }[];
}

export const createIDPResources = async (ctx: CompleteInstallContext): Promise<boolean> => {
	const { installConfig, apiServerClient, defsManager, resourceFuncsForCleanup, referencedIDPs } = ctx;
	const providedIDPs = installConfig.idpConfig[0];
	const providedIDPAuths = installConfig.idpConfig[1];

	try {
		for (let i = 0; i < providedIDPs.length; i++) {
			const idpResource = await helpers.createNewIDPResource(apiServerClient, defsManager, providedIDPs[i]);
			resourceFuncsForCleanup.push(async () =>
				helpers.deleteByResourceType(apiServerClient, defsManager, idpResource?.name as string, 'IdentityProvider', 'idp')
			);
			referencedIDPs.push({ name: idpResource?.name });

			const encryptedAccessData = await createEncryptedAccessData(providedIDPAuths[i], idpResource as GenericResource);
			providedIDPAuths[i].setAccessData(encryptedAccessData);

			const idpSecResource = await helpers.createNewIDPSecretResource(
				apiServerClient, defsManager, providedIDPAuths[i], idpResource as GenericResource
			);
			resourceFuncsForCleanup.push(async () =>
				helpers.deleteByResourceType(apiServerClient, defsManager, idpSecResource?.name as string, 'IdentityProviderSecret', 'idpsec', idpResource?.name)
			);
		}
	} catch (error) {
		console.log(chalk.redBright('rolling back installation. Could not create the Identity Provider resources'));
		await cleanResources(resourceFuncsForCleanup);
		return false;
	}

	return true;
};

export const setupEnvironment = async (ctx: CompleteInstallContext): Promise<boolean> => {
	const { installConfig, apiServerClient, defsManager, resourceFuncsForCleanup, referencedIDPs } = ctx;
	const refIDPsSubResources = { references: { identityProviders: referencedIDPs } };

	if (installConfig.centralConfig.ampcEnvInfo.isNew) {
		installConfig.centralConfig.environment = await helpers.createByResourceType(
			apiServerClient, defsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment', 'env',
			{
				axwayManaged: installConfig.centralConfig.axwayManaged,
				production: installConfig.centralConfig.production,
			},
			'',
			refIDPsSubResources,
		);
		resourceFuncsForCleanup.push(async () =>
			helpers.deleteByResourceType(apiServerClient, defsManager, installConfig.centralConfig.ampcEnvInfo.name, 'Environment', 'env')
		);
	} else {
		installConfig.centralConfig.environment = installConfig.centralConfig.ampcEnvInfo.name;
		refIDPsSubResources.references.identityProviders.push(...installConfig.centralConfig.ampcEnvInfo.referencedIdentityProviders);
		await helpers.updateSubResourceType(
			apiServerClient, defsManager,
			installConfig.centralConfig.ampcEnvInfo.name,
			'Environment', 'env', '', refIDPsSubResources,
		);
		const oldIDPRef = { references: { identityProviders: installConfig.centralConfig.ampcEnvInfo.referencedIdentityProviders } };
		resourceFuncsForCleanup.push(async () =>
			helpers.updateSubResourceType(apiServerClient, defsManager, installConfig.centralConfig.ampcEnvInfo.name, 'Environment', 'env', '', oldIDPRef)
		);
	}

	return true;
};

export const createDataplaneResources = async (
	ctx: CompleteInstallContext,
	dataplaneConfigObj: DataplaneConfig
): Promise<GenericResource | null> => {
	const { installConfig, apiServerClient, defsManager, resourceFuncsForCleanup } = ctx;
	const gatewayType = installConfig.gatewayType as GatewayTypes;

	let dataplaneRes: GenericResource;
	try {
		dataplaneRes = await helpers.createNewDataPlaneResource(
			apiServerClient, defsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[gatewayType],
			dataplaneConfigObj
		);
		resourceFuncsForCleanup.push(async () =>
			helpers.deleteByResourceType(apiServerClient, defsManager, dataplaneRes.name, 'Dataplane', 'dp', installConfig.centralConfig.environment)
		);
	} catch {
		console.log(chalk.redBright('rolling back installation. Please check the configuration data before re-running install'));
		await cleanResources(resourceFuncsForCleanup);
		return null;
	}

	try {
		const dataplaneSecretRes = await helpers.createNewDataPlaneSecretResource(
			apiServerClient, defsManager,
			installConfig.centralConfig.environment,
			GatewayTypeToDataPlane[gatewayType],
			dataplaneRes.name,
			await createEncryptedAccessData(ctx.agentValues, dataplaneRes)
		);
		resourceFuncsForCleanup.push(async () =>
			helpers.deleteByResourceType(apiServerClient, defsManager, dataplaneSecretRes?.name as string, 'DataplaneSecret', 'dps', installConfig.centralConfig.environment)
		);
	} catch {
		console.log(chalk.redBright('rolling back installation. Please check the credential data before re-running install'));
		await cleanResources(resourceFuncsForCleanup);
		return null;
	}

	return dataplaneRes;
};

export const createAgentResources = async (
	ctx: CompleteInstallContext,
	dataplaneRes: GenericResource,
	taExtraConfig?: object
): Promise<void> => {
	const { installConfig, apiServerClient, defsManager } = ctx;
	const { agentValues } = ctx;
	const gatewayType = installConfig.gatewayType as GatewayTypes;
	const dataplaneName = GatewayTypeToDataPlane[gatewayType];

	installConfig.centralConfig.daAgentName = await helpers.createNewAgentResource(
		apiServerClient, defsManager,
		installConfig.centralConfig.environment,
		dataplaneName,
		AgentResourceKind.da,
		AgentTypes.da,
		installConfig.centralConfig.ampcTeamName,
		`${dataplaneName} Discovery Agent`,
		dataplaneRes.name,
		agentValues.frequencyDA,
		agentValues.queueDA,
		undefined,
		agentValues.filterDA
	);

	if (installConfig.switches.isTaEnabled) {
		installConfig.centralConfig.taAgentName = await helpers.createNewAgentResource(
			apiServerClient, defsManager,
			installConfig.centralConfig.environment,
			dataplaneName,
			AgentResourceKind.ta,
			AgentTypes.ta,
			installConfig.centralConfig.ampcTeamName,
			`${dataplaneName} Traceability Agent`,
			dataplaneRes.name,
			agentValues.frequencyTA,
			false,
			taExtraConfig
		);
	}
};
