export const resourceRegex = '^(?:[a-z0-9]*(?:\\.(?=[a-z0-9])|-+(?=[a-z0-9]))?)+[a-z0-9]$';
export const namespaceRegex = '^[a-z0-9]?(?:[-a-z0-9]*[a-z0-9]){1,100}?$';
export const domainNameRegex = '^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\\.)+([A-Za-z]){2,}$';
export const dosaRegex = '^[\\w\\s-()[\\]]{1,100}$';
export const frequencyRegex = '^(\\d*[d])?(\\d*[h])?(\\d*[m])?$|^$';
export const maskingRegex = '^[a-zA-Z0-9-*#^~.{}]{0,5}$';
export const keyFromKeyValuePairRegex = '^[A-Za-z]+[_\-\w]+$';
export const invalidDosaName = 'Account name can contain A-z 0-9 _ - ( ) [ ] and can include 1-100 characters.';
export const invalidNamespace = 'Namespace must consist of lower case alphanumeric characters or \'-\', and must start and end with an alphanumeric character, and be fewer than 100 characters long.';
export const invalidDomainName = 'The host must be valid according to RFC 1123 specification';
export const invalidResourceMsg = (resource: string) => {
	return `${resource} must consist of lower case alphanumeric characters, ' - ' or '.', and be fewer than 100 characters long`;
};

// AWSRegexPatterns - regex patters to validate user inputs
export const AWSRegexPatterns = {
	AWS_REGEXP: '^[0-9A-Za-z\\.\\-_]*(?<!/\\.)$',
	AWS_REGEXP_LOG_GROUP_NAME: '^[0-9A-Za-z\\.\\-_]*(?<!/\\.)$|^$',
	AWS_REGEXP_VPC_ID: '^vpc-[0-9a-z]*$|^$',
	AWS_REGEXP_SECURITY_GROUP: '^sg-[0-9a-z]*$|^$',
	AWS_REGEXP_SUBNET: '^subnet-[0-9a-z]*$|^$',
	AWS_REGEXP_SSH_LOCATION: '^\\d{1,3}(\\.\\d{1,3}){3}\\/\\d{1,2}$',
	AWS_REGEXP_ACCESS_KEY_ID: '((?:ASIA|AKIA|AROA|AIDA)([A-Z0-7]{16}))',
	AWS_REGEXP_SECRET_ACCESS_KEY: '[a-zA-Z0-9+/]{40}',
	AWS_REGEXP_ROLE_ARN: '^arn:aws[a-zA-Z-]*:iam::\\d{12}:role\\/?[a-zA-Z0-9+=,.@\\-_\\/]{1,128}$',
	AWS_ACCESS_LOG_ARN: '^arn:aws[a-zA-Z-]*:logs:[a-zA-Z0-9\-]*:\\d{12}:log-group:[a-zA-Z0-9_\\-\\/\\.#]{1,512}$',
};

// APIGEEXRegexPatterns - regex patters to validate user inputs
export const APIGEEXRegexPatterns = {
	APIGEEX_REGEXP_PROJECT_ID: '^[a-z][a-z0-9-]{4,28}[a-z0-9]$',
	APIGEEX_REGEXP_EMAIL_ADDRESS: '^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$',
};

// AzureRegexPatterns - regex patters to validate user inputs
export const AzureRegexPatterns = {
	azureApiManagementServiceNameRegex: '^[a-zA-Z](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$',
	azureEventHubConsumerGroupRegex: '^[a-zA-Z0-9$][a-zA-Z0-9._\-]{0,48}[a-zA-Z0-9]$'
};

// GitHubRegexPatterns - regex patters to validate user inputs
export const GitHubRegexPatterns = {
	gitHubAccessTokenRegex: '^ghp_[a-zA-Z0-9]{36}$',
	gitHubRepositoryOwnerRegex: '^(?!-)(?!.*--)[a-zA-Z0-9-]{1,37}(?<!-)$',
	gitHubRepositoryNameRegex: '^[\\w-\\.]+$',
	gitHubFilePathRegex: '^\/.*$'
};

export const GitLabRegexPatterns = {
	gitLabAccessTokenRegex: '^[0-9a-zA-Z\-]{20}$',
	gitLabBaseURLRegex: '^(http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$',
	gitHubRepositoryIDRegex: '^[0-9]*$',
	gitLabPathRegex: '^\/.*$'
};

export const KafkaRegexPatterns = {
	bootstrapServerRegex: '^(SASL_SSL:\/\/|SASL_PLAINTEXT:\/\/|PLAINTEXT:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z0-9]{1,5}(:[0-9]{1,5})$',
	urlRegex: '^(http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$',
};

export const WSO2RegexPatterns = {
	wso2BaseURLRegex: '^(http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$',
};

export const SensediaRegexPatterns = {
	noCommaRegex: '^[^,]+$',
	emailRegex: '^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$',
	urlRegex: '^(http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$',
};

export const AkamaiRegexPatterns = {
	baseURLRegex: '^(http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$',
};

