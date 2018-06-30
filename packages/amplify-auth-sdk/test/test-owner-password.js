import Auth, { internal } from '../dist/index';
import http from 'http';
import jws from 'jws';

import { createLoginServer } from './common';
import { serverInfo } from './server-info';

const { Authenticator, OwnerPassword } = internal;

describe('Owner Password', () => {
	describe('Constructor', () => {
		it('should error if options is invalid', () => {
			expect(() => {
				new OwnerPassword();
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if username is invalid', () => {
			expect(() => {
				new OwnerPassword({});
			}).to.throw(TypeError, 'Expected username to be a non-empty string');

			expect(() => {
				new OwnerPassword({ username: null });
			}).to.throw(TypeError, 'Expected username to be a non-empty string');

			expect(() => {
				new OwnerPassword({ username: '' });
			}).to.throw(TypeError, 'Expected username to be a non-empty string');
		});

		it('should error if password is invalid', () => {
			expect(() => {
				new OwnerPassword({ username: 'foo' });
			}).to.throw(TypeError, 'Expected password to be a string');

			expect(() => {
				new OwnerPassword({ username: 'foo', password: null });
			}).to.throw(TypeError, 'Expected password to be a string');
		});
	});

	/*
	describe('Server Info', () => {
		afterEach(async function () {
			if (this.server) {
				await new Promise(resolve => {
					this.server.close(() => {
						this.server = null;
						resolve();
					});
				});
			}
		});

		it('should fetch server info', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(serverInfo));
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const auth = new  Auth({
				username: 'foo',
				password: 'bar',

				baseUrl: '<URL>',
				clientId: 'test-client',
				realm: 'test-realm',

				endpoints: {
					wellKnown: 'http://127.0.0.1:1337/'
				}
			});
			const info = await auth.serverInfo();
			expect(info).to.deep.equal(serverInfo);
		});
	});

	describe('Login', () => {
		afterEach(async function () {
			if (this.server) {
				await new Promise(resolve => this.server.close(resolve));
				this.server = null;
			}
		});

		it('should error if options is not an object', async () => {
			try {
				const auth = new Auth({
					username: 'foo',
					password: 'bar',
					baseUrl: '<URL>',
					clientId: 'test_client',
					realm: 'test_realm'
				});

				await auth.login('foo');
			} catch (err) {
				expect(err).to.be.instanceof(TypeError);
				expect(err.message).to.equal('Expected options to be an object');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate and return the access token', async function () {
			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test'
			});

			this.server = await createLoginServer({
				accessToken,
				expiresIn: 600
			});

			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			let results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);

			// stop the web server to prove subsequent logins don't make requests
			await new Promise(resolve => this.server.close(resolve));
			this.server = null;

			results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);
		});

		it('should fail if username/password is incorrect', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(401, { 'Content-Type': 'text/plain' });
				res.end('Unauthorized');
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			try {
				await auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Unauthorized');
				return;
			}

			throw new Error('Expected error');
		});

		it('should fail if server is unreachable', async () => {
			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			try {
				await auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/^request to .+ failed,/i);
				expect(e.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server returns an invalid user identity', async function () {
			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm'
			});

			const accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: { email: '' },
				secret: 'test'
			});

			this.server = http.createServer((req, res) => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({
					access_token:       accessToken,
					refresh_token:      'bar',
					expires_in:         600,
					refresh_expires_in: 600
				}));
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			try {
				await auth.login();
			} catch (e) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: invalid response from server');
				return;
			}

			throw new Error('Expected error');
		});

		it('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			let accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test1'
			});

			let counter = 0;

			this.server = await createLoginServer({
				accessToken,
				expiresIn: 1,
				token: post => {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.Password);
							expect(post.username).to.equal('foo');
							expect(post.password).to.equal('bar');
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal('bar1');
							break;
					}
				}
			});

			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			let results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);

			await new Promise(resolve => setTimeout(resolve, 2000));

			this.server.accessToken = accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test2'
			});

			results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);
		});
	});

	describe('User Info', () => {
		it.skip('should get user info', async () => {
			const auth = new Auth({
				username: 'foo',
				password: 'bar',
				baseUrl: '<URL>',
				clientId: 'test-client',
				realm: 'test-realm'
			});

			const info = await auth.userInfo();
			console.log(info);
		});
	});
	*/
});
