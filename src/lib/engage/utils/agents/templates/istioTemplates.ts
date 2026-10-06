import { CentralAgentConfig, TraceabilityConfig, IstioAgentValues, IstioInstallValues } from '../../../types.js';

/**
 * @description Values for installing the Istio Agents
 */
export class IstioValues {
	istioAgentValues: IstioAgentValues;
	istioInstallValues: IstioInstallValues;
	centralConfig: CentralAgentConfig;
	traceabilityConfig: TraceabilityConfig;

	constructor() {
		this.istioAgentValues = new IstioAgentValues();
		this.istioInstallValues = new IstioInstallValues();
		this.centralConfig = new CentralAgentConfig();
		this.traceabilityConfig = new TraceabilityConfig();
	}
}

/**
 * @description Generates the override file for the Amplify Istio Agents.
 */
export const istioAgentsTemplate = () => {
	return `---
# Config for creating the K8S Secret that holds the Amplify Platform service account details as part of the helm chart deployment
secret:
  # Set to true, and provide the following values to enable the creation of the K8S Secret
  create: false
  name: ""
  password: ""
  publicKey: ""
  privateKey: ""

# Traceability agent config
als:
  enabled: {{istioAgentValues.alsEnabled}}

  # # Traceability Agent image overrides
  # image:
  #   fullPath:
  #   registry: docker.repository.axway.com
  #   repository: ampc-beano-docker-prod/2.1
  #   name: als-traceability-agent
  #   tag:
  #   pullPolicy: IfNotPresent
  #   pullSecret:

  # Header publishing mode. Set to ambient, default, or verbose. Ambient is the recommended baseline.
  mode: {{istioAgentValues.alsMode}}

  # Name of the cluster
  clusterName: {{istioAgentValues.clusterName}}

  # Name of the secret containing the public & private keys used by the provided service account client ID
  keysSecretName: {{istioAgentValues.keysSecretName}}


  # List of namespaces where the ALS Envoy filters should be applied
  envoyFilterNamespaces:
  - {{istioAgentValues.envoyFilterNamespace}}
  publishHeaders: true

  # Amplify config overrides
  env:
    LOG_LEVEL: info 
    CENTRAL_REGION: {{centralConfig.region}}
    CENTRAL_ORGANIZATIONID: "{{centralConfig.orgId}}"
    CENTRAL_AUTH_CLIENTID: {{centralConfig.dosaAccount.clientId}}
    CENTRAL_AGENTNAME: {{centralConfig.taAgentName}}
    CENTRAL_ENVIRONMENT: {{centralConfig.environment}}
    CENTRAL_TEAM: "{{centralConfig.ampcTeamName}}"

# Discovery agent config
da:
  enabled: {{istioAgentValues.discoveryEnabled}}

  # # Discovery Agent image overrides
  # image:
  #   fullPath:
  #   registry: docker.repository.axway.com
  #   repository: ampc-beano-docker-prod/1.1
  #   name: istio-discovery-agent
  #   tag:
  #   pullPolicy: IfNotPresent
  #   pullSecret:

  # Name of the secret containing the public & private keys used by the provided service account client ID
  keysSecretName: {{istioAgentValues.keysSecretName}}

  # Name of the cluster the agent is connected to
  clusterName: {{istioAgentValues.clusterName}}

  # Resource discovery config
  discovery:
    # List of http endpoints to discover api specs from
    virtualService:
      # List of namespaces that will be used by agent to discover VirtualService resources
      namespaces:
      {{#each istioAgentValues.discoveryNamespaces}}
      - {{this}}
      {{/each}}
      # List of labels that will be used by agent to filter VirtualService resources
      labels: []
    requestAuth:
      # List of namespaces that will be used by agent to discover RequestAuthentication resources
      namespaces:
      {{#each istioAgentValues.discoveryNamespaces}}
      - {{this}}
      {{/each}}
      # List of labels that will be used by agent to filter RequestAuthentication resources
      labels: []

  # IDP Provider config
  idpProviders:

  # Amplify config overrides
  env:
    LOG_LEVEL: info
    CENTRAL_AGENTNAME: {{centralConfig.daAgentName}}
    CENTRAL_REGION: {{centralConfig.region}}
    CENTRAL_AUTH_CLIENTID: {{centralConfig.dosaAccount.clientId}}
    CENTRAL_ORGANIZATIONID: "{{centralConfig.orgId}}"
    CENTRAL_ENVIRONMENT: {{centralConfig.environment}}
    CENTRAL_TEAM: "{{centralConfig.ampcTeamName}}"

# Deploy the chart with an optional demo service
list:
  enabled: {{istioAgentValues.demoSvcEnabled}}`;
};

/**
 * @description Generates the override file to install Istio with settings to connect to the Istio Traceability Agent.
 */
export const istioInstallTemplate = () => {
	return `---
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
spec:
  meshConfig:
    enableTracing: {{istioInstallValues.enableTracing}}
    enableEnvoyAccessLogService: {{istioInstallValues.enableAls}}
    defaultConfig:
      envoyAccessLogService:
        address: ampc-hybrid-als.{{istioInstallValues.alsNamespace}}.svc.cluster.local:9000
    outboundTrafficPolicy:
      mode: REGISTRY_ONLY

{{#if istioInstallValues.isNewInstall}}
  components:
    egressGateways:
    - name: istio-egressgateway
      enabled: false

    ingressGateways:
    - name: istio-ingressgateway
      enabled: true
    {{#if istioInstallValues.host}}
      k8s:
        replicaCount: 1
        service:
          ports:
            - port: {{istioInstallValues.port}}
              targetPort: {{istioInstallValues.targetPort}}
              name: {{istioInstallValues.protocol}}-{{istioInstallValues.port}}
    {{/if}}

    pilot:
      enabled: true

  values:
    telemetry:
      enabled: true
      v2:
        enabled: true

    gateways:
      istio-ingressgateway:
        name: istio-ingressgateway
        labels:
          istio: istio-apic-ingress
          app: apic-ingress
        resources: {}
    {{#if istioInstallValues.host}}
        serviceAnnotations:
          external-dns.alpha.kubernetes.io/hostname: {{istioInstallValues.host}}.
        ports:
          - port: {{istioInstallValues.port}}
            name: {{istioInstallValues.protocol}}-{{istioInstallValues.port}}
      {{#if istioInstallValues.certSecretName}}
        secretVolumes:
          - name: {{istioInstallValues.certSecretName}}
            secretName: {{istioInstallValues.certSecretName}}
            mountPath: /etc/istio/istio-ingressgateway
      {{/if}}
    {{/if}}
{{else}}
  values:
    telemetry:
      enabled: true
      v2:
        enabled: true
{{/if}}
`;
};
