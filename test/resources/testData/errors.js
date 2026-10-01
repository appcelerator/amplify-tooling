export const e400 = {
	errors: [
		{
			status: 400,
			title: 'Validation error',
			detail: 'Name is not valid.',
			source: {
				parameter: 'name',
			},
			meta: {
				regexp: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*',
				instanceId: 'e4e087e16c8cd350016c8ce08d4c0012',
				tenantId: '355831103367913',
				authenticatedUserId: '07e6b449-3a31-4a96-8920-e87dd504cb87',
				transactionId: '1NP:5l4fSSHdEqCCSXXM',
			},
		},
	],
};

export const e401 = {
	errors: [
		{
			status: 401,
			title: 'Authentication error',
			detail: 'The user has not authenticated successfully.',
			meta: { reason: 'Failed to authenticate.', transactionId: '71e90049-17ba-4097-9398-5b6c299a6947' },
		},
	],
};

export const e404 = {
	errors: [
		{
			status: 404,
			title: 'Not found error',
			detail: 'Resource tomato not found in group management',
			meta: {
				instanceId: 'e4e087e16c8cd350016c8ce08d4c0012',
				tenantId: '355831103367913',
				authenticatedUserId: '07e6b449-3a31-4a96-8920-e87dd504cb87',
				transactionId: '1NP:5xRo9bzJ@YBQafCe',
			},
		},
	],
};

export const e500 = {
	errors: [
		{
			status: 500,
			title: 'Server error',
		},
	],
};

export const sampleInvalidQueryParamError = {
	errors: [
		{
			status: 400,
			title: 'Validation error',
			detail: 'Invalid \'query\' parameter \'[environment]\'. Supported: [metadata.resourceVersion, metadata.references.kind, metadata.scope.owner.id, metadata.scope.name, metadata.id, metadata.audit.modifyTimestamp, metadata.references.name, title, metadata.audit.createTimestamp, tags, metadata.scope.kind, metadata.references.id, owner.id, name, spec.type, attributes, state]',
			meta: {
				instanceId: '8ac98fc67684581701768c8cc0150120',
				tenantId: '332193996639746',
				authenticatedUserId: 'e9f13036-0bc7-4611-85a7-6a0901dbaabf',
				transactionId: '0c72b258-9898-49c8-be59-c7cdec030f71'
			}
		}
	]
};
