import Auth, { internal } from '../dist/index';
import fetch from 'node-fetch';
import querystring from 'querystring';

import { parse } from 'url';

describe('Server', () => {
	afterEach(async () => {
		await internal.server.stop(true);
	});

	it('should error if callback does not have an auth code', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm'
		});

		const { cancel } = await auth.login({ headless: true });

		try {
			const res = await fetch('http://127.0.0.1:3000/callback');
			expect(res.status).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if request id is not set', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm'
		});

		const { cancel } = await auth.login({ headless: true });

		try {
			const res = await fetch('http://127.0.0.1:3000/callback?code=123');
			expect(res.status).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if request id is invalid', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm'
		});

		const { cancel } = await auth.login({ headless: true });

		try {
			const res = await fetch('http://127.0.0.1:3000/callback/foo?code=123');
			expect(res.status).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if auth code is bad', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm'
		});

		const { cancel, promise, url } = await auth.login({ headless: true });
		const params = querystring.parse(parse(url).query);
		const id = params.redirect_uri.match(/\/callback\/([A-Z0-9]+)/)[1];

		// squeltch unhandled rejections
		promise.catch(err => {});

		try {
			const res = await fetch(`http://127.0.0.1:3000/callback/${id}?code=123`);
			expect(res.status).to.equal(400);
		} finally {
			await cancel();
		}
	});

	it('should error if requesting non-callback url', async () => {
		const auth = new Auth({
			baseUrl: 'http://127.0.0.1:1337',
			clientId: 'test_client',
			realm: 'test_realm'
		});

		const { cancel } = await auth.login({ headless: true });

		try {
			const res = await fetch('http://127.0.0.1:3000');
			expect(res.status).to.equal(404);
		} finally {
			await cancel();
		}
	});
});
