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
	const state = opts.state || {};

	router.get('/realms/test_realm/protocol/openid-connect/auth', ctx => {
		const { redirect_uri } = ctx.query;
		if (!redirect_uri) {
			throw new Error('No redirect uri!');
		}
		ctx.redirect(`${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}code=123456`);
	});

	router.post('/realms/test_realm/protocol/openid-connect/token', async ctx => {
		const isServiceAccount = true;
		const email = 'service@bar.com';

		// this is gross, but we set this for the userinfo call
		state.email = email;

		state.accessToken = await new SignJWT({ email })
			.setProtectedHeader({ alg: 'HS256' })
			.sign(Buffer.from('access_secret'));

		state.refreshToken = await new SignJWT({ email })
			.setProtectedHeader({ alg: 'HS256' })
			.sign(Buffer.from('refresh_secret'));

		if (!Array.isArray(state.sessions)) {
			state.sessions = [];
		}
		state.sessions.push({
			email,
			isServiceAccount,
			accessToken: state.accessToken,
			refreshToken: state.refreshToken
		});

		ctx.body = {
			access_token: state.accessToken,
			refresh_token: state.refreshToken,
			expires_in: 60,
			refresh_expires_in: 120
		};
	});

	router.get('/realms/test_realm/protocol/openid-connect/logout', ctx => {
		ctx.body = 'OK';
	});

	router.get('/realms/test_realm/protocol/openid-connect/userinfo', ctx => {
		ctx.body = {
			name: `tester`,
			email: state.email,
			org_guid: '1000'
		};
	});

	router.get('/realms/test_realm/.well-known/openid-configuration', ctx => {
		ctx.body = fs.readJsonSync(path.join(__dirname, 'server-info.json'));
	});

	server.router.use('/auth', router.routes());
}
