import chalk from 'chalk';
import { InstallationFlowMethods } from '../../../services/install-service.js';
import { AgentConfigTypes, AgentInstallConfig, BundleType, Certificate, GatewayTypes, IstioAgentValues, IstioInstallValues, IstioProfileChoices, Protocol, YesNo, YesNoChoices } from '../../../types.js';
import { createTlsCert } from '../../bash-commands.js';
import { askInput, askList, validateRegex } from '../../basic-prompts.js';
import { AgentHelmInfo, helmImageSecretInfo, helmInstallInfo, writeTemplates } from '../../utils.js';
import * as helpers from '../index.js';
import { IstioValues } from '../index.js';
import { kubectl, KubectlResponse } from '../kubectl.js';

export const amplifyAgentsNs = 'amplify-agents';
export const gatewayCertSecret = 'gateway-cert';
export const istioSystemNs = 'istio-system';
export const ampcDemoNs = 'ampc-demo';

export const defaultLogFiles = '/group-*_instance-*.log';
export const amplifyAgentsCredsSecret = 'amplify-agents-credentials';

export enum AlsMode {
	Verbose = 'verbose',
	Default = 'default',
	Ambient = 'ambient',
}

// ConfigFiles - all the config file that are used in the setup
export const ConfigFiles = {
	IstioOverrideFile: 'istio-override.yaml',
	HybridOverrideFile: 'hybrid-override.yaml',
};

export const istioPrompts = {
	// istio
	enterProtocol: 'Enter the protocol to use for the ingress gateway',
	enterPort: 'Enter the Kubernetes cluster port',
	enterIstioSecret: 'Enter the name of the secret to store the Istio gateway certificate',
	generateCertPrompt: 'Would you like to generate a self signed certificate, or provide your own?',
	enterDomainName: 'Enter the public domain name for your cluster (FQDN), if available. (leave blank to skip)',
	enterCertPath: 'Enter the file path to the certificate',
	existingIstio: 'Use existing Istio installation?',
	askEnvoyFilterNamespace: 'Select the namespace where you would like the ALS Envoy Filters to be applied',
	istioProfile: 'Select the Istio profile to use',

	// agents
	meshAgentNamespace: 'Enter the namespace to use for the Amplify Istio Agents',
	vsNamespaces: 'Select the namespace where the agent should discover Virtual Service resources',
	alsMode: 'Select Traceability Agent HTTP header publishing mode',
	demoService: 'Do you want to deploy the optional demo application?',
};

export const askBundleType = async (): Promise<BundleType> => {
	return (await askList({
		msg: helpers.agentMessages.selectAgentType,
		choices: [ BundleType.ALL_AGENTS, BundleType.DISCOVERY, BundleType.TRACEABILITY ],
	})) as BundleType;
};

export const askConfigType = async (): Promise<AgentConfigTypes> => {
	return AgentConfigTypes.DOCKERIZED;
};

export const gatewayConnectivity = async (installConfig: AgentInstallConfig): Promise<IstioValues> => {
	const istioValues: IstioValues = new IstioValues();

	console.log('\nCONNECTING A KUBERNETES CLUSTER TO AMPLIFY CENTRAL\n');
	console.log(
		chalk.gray(`The Amplify Istio Discovery Agent needs to be deployed to your Kubernetes cluster to discover APIs for publishing to Amplify Central and/or the Amplify Marketplace.
The Amplify Istio Traceability Agent needs to be deployed to your Kubernetes cluster to collect transaction telemetry to send to the Amplify Central Observer and Visibility Dashboard.`)
	);
	console.log(`
For more details on client prerequesites or Kubernetes preparation refer to the documentation here:
https://docs.axway.com/bundle/amplify-central/page/docs/connect_manage_environ/mesh_management/build_hybrid_env/index.html
`);

	const { error } = await kubectl.isInstalled();
	if (error) {
		throw new Error(
			`Kubectl is required to fill out the following prompts. It appears to be missing or misconfigured.\n${error}`
		);
	}

	const istioOverrides = await setupIstio(istioValues);

	installConfig.gatewayConfig = istioValues;

	// Set up the following values from installConfig to be used in setupKubernetes
	istioValues.istioAgentValues.alsEnabled = installConfig.switches.isTaEnabled;
	istioValues.istioAgentValues.discoveryEnabled = installConfig.switches.isDaEnabled;

	const hybridOverrides = await setupKubernetes(istioValues);
	hybridOverrides.envoyFilterNamespace = istioOverrides.envoyFilterNamespace;

	istioOverrides.alsNamespace = hybridOverrides.namespace.name;
	istioOverrides.enableAls = hybridOverrides.alsMode === AlsMode.Verbose;
	istioOverrides.enableTracing = hybridOverrides.alsEnabled;

	return istioValues;
};

// Questions for the istio configuration
const askUseExistingIstio = async (): Promise<string> =>
	askList({
		msg: istioPrompts.existingIstio,
		choices: YesNoChoices,
	});

const askEnvoyFilterNamespace = async (namespaces: KubectlResponse): Promise<string> =>
	askList({
		msg: istioPrompts.askEnvoyFilterNamespace,
		choices: namespaces.data,
	});

const askHost = async (): Promise<string> =>
	(await askInput({
		msg: istioPrompts.enterDomainName,
		validate: validateRegex(helpers.domainNameRegex, helpers.invalidDomainName),
		allowEmptyInput: true,
	})) as string;

const askProtocol = async (): Promise<string> =>
	askList({
		msg: istioPrompts.enterProtocol,
		choices: [
			{
				name: Protocol.HTTP.toUpperCase(),
				value: Protocol.HTTP,
			},
			{
				name: Protocol.HTTPS.toUpperCase(),
				value: Protocol.HTTPS,
			},
		],
	});

const askPort = async (protocol: string): Promise<number> =>
	(await askInput({
		msg: istioPrompts.enterPort,
		type: 'number',
		defaultValue: protocol === Protocol.HTTP ? 8080 : 443,
	})) as number;

const askCertificateOption = async (): Promise<string> =>
	askList({
		msg: istioPrompts.generateCertPrompt,
		choices: [
			{ name: 'Generate self signed certificate', value: Certificate.GENERATE },
			{ name: 'Provide certificate', value: Certificate.PROVIDE },
		],
	});

const askIstioProfile = async (): Promise<string> =>
	askList({
		msg: istioPrompts.istioProfile,
		choices: IstioProfileChoices,
	});

export const setupIstio = async (istioValues: IstioValues): Promise<IstioInstallValues> => {
	const istioInstallValues = istioValues.istioInstallValues;
	console.log(chalk.gray('If Istio is not yet installed, select No. If Istio is already running select Yes.\n'));

	const useExistingIstio = await askUseExistingIstio();

	if (useExistingIstio === YesNo.Yes) {
		const namespaces = await kubectl.get('namespaces');
		if (namespaces.error) {
			throw new Error(namespaces.error);
		}

		const filterNamespace = await askEnvoyFilterNamespace(namespaces);

		istioInstallValues.envoyFilterNamespace = filterNamespace;
		istioInstallValues.isNewInstall = false;
		return istioInstallValues;
	}

	istioInstallValues.profile = await askIstioProfile();

	console.log(
		chalk.gray(
			'\nFor a Kubernetes cluster exposing HTTPS endpoints, you must own or be able to configure a certificate for the correspoinding fully qualified domain name\n'
		)
	);

	istioInstallValues.host = (await askHost()).toLowerCase();

	if (istioInstallValues.host) {
		istioInstallValues.protocol = await askProtocol();
		istioInstallValues.port = await askPort(istioInstallValues.protocol);

		if (istioInstallValues.protocol === Protocol.HTTPS) {
			istioInstallValues.certSecretName = await askIstioSecret(
				istioPrompts.enterIstioSecret,
				istioSystemNs,
				gatewayCertSecret
			);
			istioInstallValues.certificateOption = await askCertificateOption();
		}
	}

	istioInstallValues.targetPort = istioInstallValues.protocol === Protocol.HTTP ? 8080 : 8443;
	return istioValues.istioInstallValues;
};

export const askIstioSecret = async (msg: string, namespace: string, defaultSecretName: string) => {
	const allSecrets = await kubectl.get('secrets', `-n ${namespace}`);
	// No resources errors are ok. Throw an error for anything else.
	if (allSecrets.error && !allSecrets.error.includes('K8S secrets: No resources found')) {
		throw Error(allSecrets.error);
	}
	return helpers.askForSecretName(msg, defaultSecretName, allSecrets.data);
};

const completeIstio = async (istioOverrides: IstioInstallValues) => {
	if (istioOverrides.protocol === Protocol.HTTPS) {
		if (istioOverrides.isNewInstall) {
			await kubectl.create('ns', istioSystemNs);
		}
		await createIstioGatewayCert(istioOverrides.envoyFilterNamespace, istioOverrides);
	}
};

// Above this line is Istio.  Below is Kubernetes

// Questions for the kubernetes configuration
const askALSMode = async (): Promise<string> => {
	return askList({
		msg: istioPrompts.alsMode,
		choices: [
			{
				name: AlsMode.Ambient.charAt(0).toUpperCase() + AlsMode.Ambient.slice(1),
				value: AlsMode.Ambient,
			},
			{
				name: AlsMode.Default.charAt(0).toUpperCase() + AlsMode.Default.slice(1),
				value: AlsMode.Default,
			},
			{
				name: AlsMode.Verbose.charAt(0).toUpperCase() + AlsMode.Verbose.slice(1),
				value: AlsMode.Verbose,
			},
		],
		default: AlsMode.Ambient,
	});
};

const askVsNamespacePrompt = async (): Promise<string> => {
	const namespaces = await kubectl.get('ns');
	if (namespaces.error) {
		throw Error(namespaces.error);
	}

	return await askList({
		msg: istioPrompts.vsNamespaces,
		choices: namespaces.data,
	});
};

const askEnableDemoSvc = async (): Promise<boolean> => {
	const res = askList({
		msg: istioPrompts.demoService,
		choices: YesNoChoices,
	});

	return (await res) === YesNo.Yes;
};

// Setup Overrides
export const setupKubernetes = async (
	istioValues: IstioValues,
): Promise<IstioAgentValues> => {
	const istioAgentValues = istioValues.istioAgentValues;

	console.log(
		chalk.gray(
			'\nThere are several steps to prepare a Kubernetes cluster for the Amplify Istio Agents.\nThe following questions collect the namespace and secret to use for the Istio gateway.\n'
		)
	);

	if (istioAgentValues.alsEnabled) {
		console.log(
			chalk.gray(
				'\nThe Istio Traceability Agent supports three modes: default (minimal required header subset), ambient (baseline headers with optional Telemetry CR emission), and verbose (capture all request/response headers).\n'
			)
		);

		istioAgentValues.alsMode = await askALSMode();
	}

	if (istioAgentValues.discoveryEnabled) {
		const ns = await askVsNamespacePrompt();
		istioAgentValues.discoveryNamespaces = [ ns ];
	}

	istioAgentValues.namespace = await helpers.askNamespace(istioPrompts.meshAgentNamespace, amplifyAgentsNs);
	istioAgentValues.demoSvcEnabled = await askEnableDemoSvc();

	if (
		istioAgentValues.discoveryEnabled
		&& istioAgentValues.demoSvcEnabled
		&& !istioAgentValues.discoveryNamespaces.includes(ampcDemoNs)
	) {
		istioAgentValues.discoveryNamespaces.push(ampcDemoNs);
	}

	// set keySecretName
	istioAgentValues.keysSecretName = helpers.amplifyAgentsKeysSecret;

	istioAgentValues.clusterName = await helpers.askClusterName();

	return istioAgentValues;
};

export const createIstioGatewayCert = async (namespace: string, istioOverrides: IstioInstallValues) => {
	let privateKey = '';
	let cert = '';
	if (istioOverrides.certificateOption === Certificate.GENERATE) {
		({ cert, privateKey } = await createTlsCert(
			istioOverrides.certSecretName as string,
			istioOverrides.host as string
		));
		console.log(
			`Created ${istioOverrides.certSecretName}.crt and ${istioOverrides.certSecretName}.key in ${process.cwd()}`
		);
	} else {
		privateKey = (await askInput({ msg: helpers.enterPublicKeyPath })) as string;
		cert = (await askInput({ msg: istioPrompts.enterCertPath })) as string;
	}
	const { data, error } = await kubectl.create(
		'secret',
		`-n ${namespace} tls ${istioOverrides.certSecretName} --cert=${cert} --key=${privateKey}`
	);
	if (error) {
		throw new Error(error);
	}
	console.log(`Created ${data[0]} in the ${namespace} namespace.`);
};

export const createIstioOverride = (overrides: IstioValues): void => {
	const overrideFileName = ConfigFiles.IstioOverrideFile;

	writeTemplates(overrideFileName, overrides, helpers.istioInstallTemplate);

	console.log(`\nIstio override file has been placed at ${process.cwd()}/${overrideFileName}`);
	if (overrides.istioInstallValues.isNewInstall) {
		console.log(
			'To complete the istio installation run the following command:',
			chalk.cyan(`\n  istioctl install --set profile=${overrides.istioInstallValues.profile} -f ${overrideFileName}\n`)
		);
	} else {
		console.log(
			chalk.cyan(
				`  Please merge the generated ${overrideFileName} file with your Istio configuration to allow the Traceability Agent to function.\n`
			)
		);
	}
};

export const createHybridOverride = (overrides: IstioValues) => {
	const overrideFileName = ConfigFiles.HybridOverrideFile;

	writeTemplates(overrideFileName, overrides, helpers.istioAgentsTemplate);

	console.log(`Istio agent override file has been placed at ${process.cwd()}/${overrideFileName}`);
	helmImageSecretInfo(overrides.istioAgentValues.namespace.name);

	const agentHelmInfo = new Set<AgentHelmInfo>();
	agentHelmInfo.add({
		helmReleaseName: 'ampc-hybrid',
		helmChartName: 'axway/ampc-hybrid',
		overrideFileName: overrideFileName,
		imageSecretOverrides: '--set da.image.pullSecret=<image-pull-secret-name> --set als.image.pullSecret=<image-pull-secret-name>' });

	helmInstallInfo(
		'Istio',
		overrides.istioAgentValues.namespace.name,
		agentHelmInfo
	);
};

export const installPreprocess = async (installConfig: AgentInstallConfig): Promise<AgentInstallConfig> => {
	// name of the service account, and if it is new or not

	if (!installConfig.centralConfig.ampcDosaInfo.isNew) {
		[ installConfig.centralConfig.dosaAccount.publicKey, installConfig.centralConfig.dosaAccount.privateKey ]
			= await helpers.askPublicAndPrivateKeysPath();
	} else {
		console.log(
			chalk.yellow(
				'The secret will be created with the same "private_key.pem" and "public_key.pem" that will be auto generated to create the Service Account, following the completion of these prompts.'
			)
		);
	}

	return installConfig;
};

export const completeInstall = async (installConfig: AgentInstallConfig): Promise<void> => {
	// Contents of completeKubernetes moved here.

	const istioValues = installConfig.gatewayConfig as IstioValues;

	// Add final settings to IstioAgentsValues
	istioValues.centralConfig = installConfig.centralConfig;
	istioValues.traceabilityConfig = installConfig.traceabilityConfig;

	await completeIstio(istioValues.istioInstallValues);

	if (istioValues.istioAgentValues.namespace.isNew) {
		await helpers.createNamespace(istioValues.istioAgentValues.namespace.name);
	}

	await helpers.createSecret(istioValues.istioAgentValues.namespace.name, helpers.amplifyAgentsKeysSecret, async () => {
		if (installConfig.centralConfig.ampcDosaInfo.isNew) {
			console.log(
				chalk.yellow(
					`The secret '${helpers.amplifyAgentsKeysSecret}' will be created with the same "private_key.pem" and "public_key.pem" that was auto generated to create the Service Account.`
				)
			);
		}

		await helpers.createAmplifyAgentKeysSecret(
			istioValues.istioAgentValues.namespace.name,
			helpers.amplifyAgentsKeysSecret,
			'publicKey',
			istioValues.centralConfig.dosaAccount.publicKey,
			'privateKey',
			istioValues.centralConfig.dosaAccount.privateKey
		);
	});

	console.log('Generating the configuration file(s)...');

	createIstioOverride(istioValues);
	createHybridOverride(istioValues);

	console.log('Configuration file(s) have been successfully created.\n');

	console.log(
		chalk.gray(`\nAdditional information about agent features can be found here:\n${helpers.agentsDocsUrl.ISTIO}`)
	);
};

export const IstioInstallMethods: InstallationFlowMethods = {
	GetBundleType: askBundleType,
	GetDeploymentType: askConfigType,
	AskGatewayQuestions: gatewayConnectivity,
	InstallPreprocess: installPreprocess,
	FinalizeGatewayInstall: completeInstall,
	ConfigFiles: Object.values(ConfigFiles),
	GatewayDisplay: GatewayTypes.ISTIO,
};
