import jws from 'jws';
import Router from '@koa/router';

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

	router.post('/realms/test_realm/protocol/openid-connect/token', ctx => {
		state.accessToken = jws.sign({
			header: { alg: 'HS256' },
			payload: { email: 'foo@bar.com' },
			secret: `access_secret`
		});

		state.refreshToken = jws.sign({
			header: { alg: 'HS256' },
			payload: { email: 'foo@bar.com' },
			secret: `refresh_secret`
		});

		ctx.body = {
			access_token:       state.accessToken,
			refresh_token:      state.refreshToken,
			expires_in:         10,
			refresh_expires_in: 10
		};
	});

	router.get('/realms/test_realm/protocol/openid-connect/logout', ctx => {
		ctx.body = 'OK';
	});

	router.get('/realms/test_realm/protocol/openid-connect/userinfo', ctx => {
		ctx.body = {
			name: `tester`,
			email: 'foo@bar.com'
		};
	});

	router.get('/realms/test_realm/.well-known/openid-configuration', ctx => {
		ctx.body = JSON.parse(fs.readFileSync(path.join(__dirname, 'server-info.json')));
	});

	server.router.use('/auth', router.routes());
}
