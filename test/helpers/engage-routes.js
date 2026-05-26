import fs from 'fs';
import path from 'path';
import Router from '@koa/router';
import { fileURLToPath } from 'url';
import bodyParser from 'koa-bodyparser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testDataDir = path.join(__dirname, '../resources/testData');

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pagedResponse(ctx, items) {
	ctx.set('x-axway-total-count', String(items.length));
	ctx.body = items;
}

const pluralKindMap = {
	environments: 'Environment',
	apiservices: 'APIService',
	secrets: 'Secret',
	webhooks: 'Webhook',
	assets: 'Asset',
	products: 'Product',
	releasetags: 'ReleaseTag',
	agentinstances: 'AgentInstance'
};

function toPluralKind(kind) {
	return pluralKindMap[kind] || kind;
}

function legacyNameKey(kind, name) {
	return `${toPluralKind(kind)}/${name}`;
}

/**
 * Sets up routes for a mock Engage / API-Central server.
 * Handles definition spec fetching (/apis/definitions/**)
 * and management/catalog resource CRUD (/apis/management/**, /apis/catalog/**).
 *
 * The server also exposes `server.engageResources` Map for test setup:
 *   server.engageResources.set('management/v1alpha1/environments/testenv1', responseBody)
 */
export function createEngageRoutes(server) {
	const router = new Router();

	const groups = readJson(path.join(testDataDir, 'apiResponses/groups.json'));
	const managementResources = readJson(path.join(testDataDir, 'apiResponses/managementResources.json'));
	const managementCommandLines = readJson(path.join(testDataDir, 'apiResponses/managementCommandLines.json'));
	const catalogResources = readJson(path.join(testDataDir, 'apiResponses/catalogResources.json'));
	const catalogCommandLines = readJson(path.join(testDataDir, 'apiResponses/catalogCommandLines.json'));

	// Spec/definition routes
	router.get('/apis/definitions/v1alpha1/groups', ctx => pagedResponse(ctx, groups));
	router.get('/apis/definitions/v1alpha1/groups/management/resources', ctx => pagedResponse(ctx, managementResources));
	router.get('/apis/definitions/v1alpha1/groups/management/commandlines', ctx => pagedResponse(ctx, managementCommandLines));
	router.get('/apis/definitions/v1alpha1/groups/catalog/resources', ctx => pagedResponse(ctx, catalogResources));
	router.get('/apis/definitions/v1alpha1/groups/catalog/commandlines', ctx => pagedResponse(ctx, catalogCommandLines));
	router.get('/apis/definitions/v1alpha1/groups/definitions/resources', ctx => pagedResponse(ctx, managementResources));
	router.get('/apis/definitions/v1alpha1/groups/definitions/commandlines', ctx => pagedResponse(ctx, managementResources));

	// Generic resource routes - delegates to server.engageResources for test control.
	// server.forceErrors map can override any route's response: key = 'METHOD:group/version/...rest'

	function forced(ctx, key, legacyKeys = []) {
		const err = server.forceErrors.get(key)
			|| legacyKeys.map(k => server.forceErrors.get(k)).find(Boolean);
		if (!err) {
			return false;
		}
		ctx.status = err.status;
		ctx.body = err.body;
		return true;
	}

	// GET list of resources (no name)
	router.get('/apis/:group/:version/:kind', ctx => {
		const { group, version, kind } = ctx.params;
		if (forced(ctx, `GET:${group}/${version}/${kind}`)) {
			return;
		}
		const prefix = `${group}/${version}/${kind}/`;
		const items = [];
		for (const [ key, value ] of server.engageResources.entries()) {
			if (key.startsWith(prefix) && key.split('/').length === 4) {
				items.push(value);
				continue;
			}
			if (key.split('/').length === 2 && key.startsWith(`${toPluralKind(kind)}/`)) {
				items.push(value);
			}
		}
		pagedResponse(ctx, items);
	});

	// GET list of scoped resources (no name)
	router.get('/apis/:group/:version/:scopeKind/:scopeName/:kind', ctx => {
		const { group, version, scopeKind, scopeName, kind } = ctx.params;
		if (forced(ctx, `GET:${group}/${version}/${scopeKind}/${scopeName}/${kind}`)) {
			return;
		}
		const prefix = `${group}/${version}/${scopeKind}/${scopeName}/${kind}/`;
		const items = [];
		for (const [ key, value ] of server.engageResources.entries()) {
			if (key.startsWith(prefix)) {
				items.push(value);
			}
		}
		pagedResponse(ctx, items);
	});

	// GET a specific resource by name
	router.get('/apis/:group/:version/:kind/:name', ctx => {
		const { group, version, kind, name } = ctx.params;
		if (forced(ctx, `GET:${group}/${version}/${kind}/${name}`, [ legacyNameKey(kind, name) ])) {
			return;
		}
		const resource = server.engageResources.get(`${group}/${version}/${kind}/${name}`)
			?? server.engageResources.get(legacyNameKey(kind, name));
		if (resource === undefined) {
			ctx.status = 404;
			ctx.body = { errors: [ { status: 404, title: 'Not found', detail: `${kind}/${name} not found` } ] };
		} else {
			ctx.body = resource;
		}
	});

	// GET scoped resource (e.g. environments/:scopeName/apiservices/:name)
	router.get('/apis/:group/:version/:scopeKind/:scopeName/:kind/:name', ctx => {
		const { group, version, scopeKind, scopeName, kind, name } = ctx.params;
		if (forced(ctx, `GET:${group}/${version}/${scopeKind}/${scopeName}/${kind}/${name}`, [ legacyNameKey(kind, name) ])) {
			return;
		}
		const resource = server.engageResources.get(`${group}/${version}/${scopeKind}/${scopeName}/${kind}/${name}`)
			?? server.engageResources.get(legacyNameKey(kind, name));
		if (resource === undefined) {
			ctx.status = 404;
			ctx.body = { errors: [ { status: 404, title: 'Not found', detail: `${scopeKind}/${scopeName}/${kind}/${name} not found` } ] };
		} else if (kind === 'releasetags' && !resource.status?.level) {
			ctx.body = { ...resource, status: { level: 'Success' } };
		} else {
			ctx.body = resource;
		}
	});

	// PUT sub-resource (e.g. assets/:name/icon?fields=icon)
	router.put('/apis/:group/:version/:kind/:name/:subresource', async ctx => {
		const { group, version, kind, name, subresource } = ctx.params;
		if (forced(ctx, `PUT:${group}/${version}/${kind}/${name}/${subresource}`, [ legacyNameKey(kind, name) ])) {
			return;
		}
		ctx.body = ctx.request.body;
	});

	// PUT (update) a specific resource
	router.put('/apis/:group/:version/:kind/:name', async ctx => {
		const { group, version, kind, name } = ctx.params;
		if (forced(ctx, `PUT:${group}/${version}/${kind}/${name}`, [ legacyNameKey(kind, name) ])) {
			return;
		}
		const body = ctx.request.body;
		server.engageResources.set(`${group}/${version}/${kind}/${name}`, body);
		server.engageResources.set(legacyNameKey(kind, name), body);
		ctx.body = body;
	});

	// PUT scoped resource
	router.put('/apis/:group/:version/:scopeKind/:scopeName/:kind/:name', async ctx => {
		const { group, version, scopeKind, scopeName, kind, name } = ctx.params;
		if (forced(ctx, `PUT:${group}/${version}/${scopeKind}/${scopeName}/${kind}/${name}`, [ legacyNameKey(kind, name) ])) {
			return;
		}
		const body = ctx.request.body;
		server.engageResources.set(`${group}/${version}/${scopeKind}/${scopeName}/${kind}/${name}`, body);
		server.engageResources.set(legacyNameKey(kind, name), body);
		ctx.body = body;
	});

	// POST (create) a collection
	router.post('/apis/:group/:version/:kind', async ctx => {
		const { group, version, kind } = ctx.params;
		if (forced(ctx, `POST:${group}/${version}/${kind}`)) {
			return;
		}
		const body = ctx.request.body;
		const name = body.name || `autogen-${Date.now()}`;
		const resourceWithName = { ...body, name };
		server.engageResources.set(`${group}/${version}/${kind}/${name}`, resourceWithName);
		server.engageResources.set(legacyNameKey(kind, name), resourceWithName);
		ctx.status = 201;
		ctx.body = resourceWithName;
	});

	// POST scoped collection
	router.post('/apis/:group/:version/:scopeKind/:scopeName/:kind', async ctx => {
		const { group, version, scopeKind, scopeName, kind } = ctx.params;
		if (forced(ctx, `POST:${group}/${version}/${scopeKind}/${scopeName}/${kind}`)) {
			return;
		}
		const body = ctx.request.body;
		const name = body.name || `autogen-${Date.now()}`;
		const resourceWithName = { ...body, name };
		server.engageResources.set(`${group}/${version}/${scopeKind}/${scopeName}/${kind}/${name}`, resourceWithName);
		server.engageResources.set(legacyNameKey(kind, name), resourceWithName);
		ctx.status = 201;
		ctx.body = resourceWithName;
	});

	// DELETE a specific resource by name
	router.delete('/apis/:group/:version/:kind/:name', ctx => {
		const { group, version, kind, name } = ctx.params;
		if (forced(ctx, `DELETE:${group}/${version}/${kind}/${name}`, [ legacyNameKey(kind, name) ])) {
			return;
		}
		const key = `${group}/${version}/${kind}/${name}`;
		const legacyKey = legacyNameKey(kind, name);
		if (!server.engageResources.has(key) && !server.engageResources.has(legacyKey)) {
			ctx.status = 404;
			ctx.body = { errors: [ { status: 404, title: 'Not found', detail: `${kind}/${name} not found` } ] };
			return;
		}
		server.engageResources.delete(key);
		server.engageResources.delete(legacyKey);
		ctx.status = 200;
		ctx.body = {};
	});

	// DELETE scoped resource
	router.delete('/apis/:group/:version/:scopeKind/:scopeName/:kind/:name', ctx => {
		const { group, version, scopeKind, scopeName, kind, name } = ctx.params;
		if (forced(ctx, `DELETE:${group}/${version}/${scopeKind}/${scopeName}/${kind}/${name}`, [ legacyNameKey(kind, name) ])) {
			return;
		}
		const key = `${group}/${version}/${scopeKind}/${scopeName}/${kind}/${name}`;
		const legacyKey = legacyNameKey(kind, name);
		if (!server.engageResources.has(key) && !server.engageResources.has(legacyKey)) {
			ctx.status = 404;
			ctx.body = { errors: [ { status: 404, title: 'Not found', detail: `${scopeKind}/${scopeName}/${kind}/${name} not found` } ] };
			return;
		}
		server.engageResources.delete(key);
		server.engageResources.delete(legacyKey);
		ctx.status = 200;
		ctx.body = {};
	});

	// HEAD collection – used by productize to check for existing assets
	router.head('/apis/:group/:version/:kind', ctx => {
		const { group, version, kind } = ctx.params;
		if (forced(ctx, `HEAD:${group}/${version}/${kind}`)) {
			return;
		}
		const prefix = `${group}/${version}/${kind}/`;
		let count = 0;
		for (const [ key ] of server.engageResources.entries()) {
			if (key.startsWith(prefix) && key.split('/').length === 4) {
				count++;
			}
		}
		ctx.set('x-axway-total-count', String(count));
		ctx.status = 200;
	});

	server.app.use(bodyParser());
	server.router.use(router.routes());

	server.engageResources = new Map();
	server.forceErrors = new Map();
	server.resetEngageState = () => {
		server.engageResources = new Map();
		server.forceErrors = new Map();
	};
	server.resetState = () => {
		server.resetEngageState();
	};
}
