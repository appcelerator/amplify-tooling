import fs from 'fs-extra';
import { SignJWT } from 'jose';
import path from 'path';
import Router from '@koa/router';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
		const accessTokenPayload = {
			exp: Date.now() / 1000 + 60,
			iat: Date.now() / 1000,
			jti: '8b6c494f-5a89-49ea-ba38-427b4dcf39c6',
			iss: 'http://localhost:8555/auth/realms/test_realm',
			aud: 'account',
			sub: '9370d214-6c08-47fe-84ac-43955bf54ca6',
			typ: 'Bearer',
			azp: 'test-auth-client',
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
			support_access_code: '12345',
			clientId: 'test-auth-client',
			clientHost: '127.0.0.1',
			org_guid: '1000',
			email_verified: false,
			guid: '2c033616-d195-4a2e-9562-568f5ec71821',
			preferred_username: 'service-account-test-auth-client',
			clientAddress: '127.0.0.1',
			orgId: 100
		};
		state.accessToken = await new SignJWT(accessTokenPayload)
			.setProtectedHeader({ alg: 'HS256' })
			.sign(Buffer.from('access_secret'));

		const idTokenPayload = {
			exp: Date.now() / 1000 + 60,
			iat: Date.now() / 1000,
			jti: '6d51f250-9b9a-446e-87e9-2d94d7195a5b',
			iss: 'http://localhost:8555/auth/realms/test_realm',
			aud: 'test-auth-client',
			sub: '9370d214-6c08-47fe-84ac-43955bf54ca6',
			typ: 'ID',
			azp: 'test-auth-client',
			at_hash: 'hKn_pbckrcnKlRWjT0U2xA',
			support_access_code: '12345',
			clientId: 'test-auth-client',
			clientHost: '127.0.0.1',
			org_guid: '1000',
			email_verified: false,
			guid: '2c033616-d195-4a2e-9562-568f5ec71821',
			preferred_username: 'service-account-test-auth-client',
			clientAddress: '127.0.0.1',
			orgId: 100
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
			expires_in: 60
		};
	});

	router.get('/realms/test_realm/protocol/openid-connect/logout', ctx => {
		ctx.body = 'OK';
	});

	router.get('/realms/test_realm/protocol/openid-connect/userinfo', ctx => {
		ctx.body = {
			sub: '9370d214-6c08-47fe-84ac-43955bf54ca6',
			support_access_code: '12345',
			org_guid: '1000',
			email_verified: false,
			guid: '2c033616-d195-4a2e-9562-568f5ec71821',
			preferred_username: 'service-account-test-auth-client',
			orgId: '100'
		};
	});

	router.get('/realms/test_realm/.well-known/openid-configuration', ctx => {
		ctx.body = fs.readJsonSync(path.join(__dirname, 'server-info.json'));
	});

	server.router.use('/auth', router.routes());
}
