import Auth, { internal } from '../dist/index';
import http from 'http';
import jws from 'jws';
import path from 'path';

const { SignedJWT } = internal;

describe('Signed JWT', () => {
	describe('Constructor', () => {
		it('should error if options is invalid', () => {
			expect(() => {
				new SignedJWT();
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if JWT file is invalid', () => {
			expect(() => {
				new SignedJWT({});
			}).to.throw(TypeError, 'Expected JWT secret key file to be a non-empty string');

			expect(() => {
				new SignedJWT({ secretFile: null });
			}).to.throw(TypeError, 'Expected JWT secret key file to be a non-empty string');

			expect(() => {
				new SignedJWT({ secretFile: '' });
			}).to.throw(TypeError, 'Expected JWT secret key file to be a non-empty string');
		});
	});

	describe('Authorization URL', () => {
		it('should generate a authorization URL', () => {
			const auth = new Auth({
				secretFile: '###',
				baseUrl: '###',
				clientId: '###',
				realm: '###'
			});

			expect(auth.authenticator.authorizationUrl).to.be.null;
		});
	});

	describe('Login', () => {
		afterEach(async function () {
			if (this.server) {
				await new Promise(resolve => this.server.close(resolve));
				this.server = null;
			}
		});

		it('should error if JWT file does not exist', async () => {
			const secretFile = path.join(__dirname, 'does_not_exist');

			try {
				const auth = new Auth({
					secretFile,
					baseUrl: '<URL>',
					clientId: 'test_client',
					realm: 'test_realm'
				});

				await auth.login();
			} catch (err) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal(`JWT secret key file does not exist: ${secretFile}`);
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

			this.server = http.createServer((req, res) => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({
					access_token:       accessToken,
					refresh_token:      'bar',
					expires_in:         10,
					refresh_expires_in: 600
				}));
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const auth = new Auth({
				secretFile: path.join(__dirname, 'rsa-private.pem'),
				baseUrl:    'http://127.0.0.1:1337',
				clientId:   'test_client',
				realm:      'test_realm',
				tokenRefreshThreshold: 0
			});

			let results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);

			const { signedJWT } = auth.authenticator;

			// stop the web server to prove subsequent logins don't make requests
			await new Promise(resolve => this.server.close(resolve));
			this.server = null;

			results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);

			expect(auth.authenticator.getSignedJWT()).to.equal(signedJWT);

			const expires = auth.expiresIn;
			expect(expires).to.not.be.null;
			const target = Date.now() + 10000;
			expect(expires).to.be.within(target - 100, target + 100);
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
				secretFile: path.join(__dirname, 'rsa-private.pem'),
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

		it('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			let accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test1'
			});

			this.server = http.createServer((req, res) => {
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({
					access_token:       accessToken,
					refresh_token:      'bar',
					expires_in:         1,
					refresh_expires_in: 600
				}));
			});

			await new Promise((resolve, reject) => {
				this.server
					.on('listening', resolve)
					.on('error', reject)
					.listen(1337, '127.0.0.1');
			});

			const auth = new Auth({
				secretFile: path.join(__dirname, 'rsa-private.pem'),
				baseUrl: 'http://127.0.0.1:1337',
				clientId: 'test_client',
				realm: 'test_realm',
				tokenRefreshThreshold: 0
			});

			let results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);

			await new Promise(resolve => setTimeout(resolve, 2000));

			accessToken = jws.sign({
				header: { alg: 'HS256' },
				payload: '{"email":"foo@bar.com"}',
				secret: 'test2'
			});

			results = await auth.login();
			expect(results.accessToken).to.equal(accessToken);
		});
	});

	describe('User Info', () => {
		it('should get user info', async () => {
			const auth = new Auth({
				secretFile: '###',
				baseUrl: '###',
				clientId: '###',
				realm: '###'
			});

			// const info = await auth.userInfo();
			// console.log(info);
		});
	});
});
