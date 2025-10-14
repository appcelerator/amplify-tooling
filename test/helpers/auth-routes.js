import { decodeJwt, SignJWT } from 'jose';
import path from 'path';
import Router from '@koa/router';
import { readJsonSync } from '../../dist/lib/fs.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultData = readJsonSync(path.join(__dirname, 'data.json'));
const clients = defaultData.clients.reduce((obj, client) => {
	obj[client.client_id] = client;
	return obj;
}, {});
const orgMap = defaultData.orgs.reduce((obj, org) => {
	obj[org.guid] = org;
	return obj;
}, {});

export function createAuthRoutes(server, opts = {}) {
	const router = new Router();
	let state = opts.state || {};

	server.resetState = data => {
		state = data || opts.state || {};
	};

	router.get('/realms/test_realm/protocol/openid-connect/auth', ctx => {
		const { redirect_uri } = ctx.query;
		if (!redirect_uri) {
			throw new Error('No redirect uri!');
		}
		ctx.redirect(`${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}code=123456`);
	});

	router.post('/realms/test_realm/protocol/openid-connect/token', async ctx => {
		const clientId = ctx.request.body.client_id;
		if (!clientId || !clients[clientId]) {
			ctx.status = 401;
			return;
		}
		// If the client is a secret type then ensure the secret matches
		if (clientId === 'test-auth-client-secret' && ctx.request.body.client_secret !== 'shhhh') {
			ctx.status = 401;
		}
		if (clientId === 'test-auth-client-cert') {
			const payload = decodeJwt(ctx.request.body.client_assertion);
			if (payload.iss !== 'test-auth-client-cert') {
				ctx.status = 401;
				return;
			}
		}

		// Allow tests to override the token expiry time via env variable
		const tokenExpirySeconds = Number(process.env.TOKEN_EXPIRY) || 60;
		const accessTokenPayload = {
			exp: Date.now() / 1000 + tokenExpirySeconds,
			iat: Date.now() / 1000,
			jti: '8b6c494f-5a89-49ea-ba38-427b4dcf39c6',
			iss: 'http://localhost:8555/auth/realms/test_realm',
			aud: 'account',
			sub: clients[clientId].guid,
			typ: 'Bearer',
			azp: clientId,
			realm_access: {
				roles: [
					'administrator',
					'offline_access',
					'uma_authorization'
				]
			},
			resource_access: {
				account: {
					roles: [
						"manage-account",
						"manage-account-links",
						"view-profile"
					]
				}
			},
			scope: 'openid profile email',
			support_access_code: orgMap[clients[clientId].org_guid].support_access_code,
			clientId: clientId,
			clientHost: '127.0.0.1',
			org_guid: clients[clientId].org_guid,
			email_verified: false,
			guid: clients[clientId].guid,
			preferred_username: `service-account-${clientId}`,
			clientAddress: '127.0.0.1',
			orgId: orgMap[clients[clientId].org_guid].org_id
		};
		state.accessToken = await new SignJWT(accessTokenPayload)
			.setProtectedHeader({ alg: 'HS256' })
			.sign(Buffer.from('access_secret'));

		const idTokenPayload = {
			exp: Date.now() / 1000 + tokenExpirySeconds,
			iat: Date.now() / 1000,
			jti: '6d51f250-9b9a-446e-87e9-2d94d7195a5b',
			iss: 'http://localhost:8555/auth/realms/test_realm',
			aud: clientId,
			sub: clients[clientId].guid,
			typ: 'ID',
			azp: clientId,
			at_hash: 'hKn_pbckrcnKlRWjT0U2xA',
			support_access_code: orgMap[clients[clientId].org_guid].support_access_code,
			clientId: clientId,
			clientHost: '127.0.0.1',
			org_guid: clients[clientId].org_guid,
			email_verified: false,
			guid: clients[clientId].guid,
			preferred_username: `service-account-${clientId}`,
			clientAddress: '127.0.0.1',
			orgId: orgMap[clients[clientId].org_guid].org_id
		};
		const idToken = await new SignJWT(idTokenPayload)
			.setProtectedHeader({ alg: 'HS256' })
			.sign(Buffer.from('id_secret'));

		if (!Array.isArray(state.sessions)) {
			state.sessions = [];
		}
		state.sessions.push({
			accessToken: state.accessToken
		});

		ctx.body = {
			id_token: idToken,
			access_token: state.accessToken,
			expires_in: tokenExpirySeconds
		};
	});

	router.get('/realms/test_realm/protocol/openid-connect/logout', ctx => {
		ctx.body = 'OK';
	});

	router.get('/realms/test_realm/protocol/openid-connect/userinfo', ctx => {
		const client = decodeJwt(ctx.headers.authorization.replace('Bearer ', ''));

		ctx.body = {
			sub: client.guid,
			support_access_code: orgMap[clients[client.clientId].org_guid].support_access_code,
			org_guid: client.org_guid,
			email_verified: false,
			guid: client.guid,
			preferred_username: `service-account-${client.clientId}`,
			orgId: orgMap[client.org_guid].org_id
		};
	});

	router.get('/realms/test_realm/.well-known/openid-configuration', ctx => {
		ctx.body = readJsonSync(path.join(__dirname, 'server-info.json'));
	});

	server.router.use('/auth', router.routes());
}
