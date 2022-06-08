import http from 'http';
import path from 'path';
import { Account } from '../src/types.js';
import { Auth, Authenticator, SignedJWT } from '../src/index.js';
import { createLoginServer, stopLoginServer } from './common.js';
import { expect } from 'chai';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Signed JWT', () => {
	describe('Constructor', () => {
		it('should error if options is invalid', () => {
			expect(() => {
				new SignedJWT();
			}).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should error if secret is invalid', () => {
			expect(() => {
				new SignedJWT({} as any);
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secret: null } as any);
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secret: '' } as any);
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secret: 123 } as any);
			}).to.throw(TypeError, 'Expected private key to be a string');

			expect(() => {
				new SignedJWT({ secretFile: null } as any);
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secretFile: '' } as any);
			}).to.throw(Error, 'Expected either a private key or private key file to be an object');

			expect(() => {
				new SignedJWT({ secretFile: 123 } as any);
			}).to.throw(Error, 'Expected private key file path to be a string');

			expect(() => {
				new SignedJWT({ secretFile: __dirname } as any);
			}).to.throw(Error, /^Specified private key is not a file:/);
		});
	});

	describe('Login', () => {
		afterEach(stopLoginServer);

		it('should error if private key file does not exist', async function () {
			const secretFile = path.join(__dirname, 'does_not_exist');

			const auth = new Auth({
				secretFile,
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login();
			} catch (err: any) {
				expect(err).to.be.instanceof(Error);
				expect(err.message).to.equal(`Specified private key file does not exist: ${secretFile}`);
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if login options is not an object', async function () {
			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login('foo' as any);
			} catch (err: any) {
				expect(err).to.be.instanceof(TypeError);
				expect(err.message).to.equal('Expected options to be an object');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server is unreachable', async function () {
			this.timeout(5000);

			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login();
			} catch (e: any) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.match(/connect ECONNREFUSED 127.0.0.1:133/i);
				expect(e.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if JWT token is incorrect', async function () {
			this.server = await createLoginServer({
				handler(req: http.IncomingMessage, res: http.ServerResponse) {
					res.writeHead(401, { 'Content-Type': 'text/plain' });
					res.end('Unauthorized');
				}
			});

			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			try {
				await auth.login();
			} catch (e: any) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: Response code 401 (Unauthorized)');
				return;
			}

			throw new Error('Expected error');
		});

		it('should error if server returns an invalid user identity', async function () {
			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: null
			});

			this.server = await createLoginServer({
				handler(req: http.IncomingMessage, res: http.ServerResponse) {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify({
						access_token:       'foo',
						refresh_token:      'bar',
						expires_in:         600,
						refresh_expires_in: 600
					}));
				}
			});

			try {
				await auth.login();
			} catch (e: any) {
				expect(e).to.be.instanceof(Error);
				expect(e.message).to.equal('Authentication failed: Invalid server response');
				return;
			}

			throw new Error('Expected error');
		});

		it('should authenticate and return the access token', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				token(post: any) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.ClientCredentials);
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal('bar1');
							break;
					}
				}
			});

			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account: Account = await auth.login() as Account;
			expect(account.name).to.equal('test_client:foo@bar.com');
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
		});

		it('should refresh the access token', async function () {
			this.slow(4000);
			this.timeout(5000);

			let counter = 0;

			this.server = await createLoginServer({
				expiresIn: 1,
				token(post: any) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.ClientCredentials);
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							break;
					}
				}
			});

			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			let results: Account = await auth.login() as Account;
			const { accessToken } = this.server;
			expect(results.auth.tokens.access_token).to.equal(accessToken);

			await new Promise(resolve => setTimeout(resolve, 1500));

			results = await auth.login() as Account;
			expect(results.auth.tokens.access_token).to.not.equal(accessToken);
			expect(results.auth.tokens.access_token).to.equal(this.server.accessToken);
		});

		it('should authenticate when user info returns error', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				token(post: any) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.ClientCredentials);
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal('bar1');
							break;
					}
				},
				userinfo(post: any, req: http.IncomingMessage, res: http.ServerResponse) {
					res.writeHead(500, { 'Content-Type': 'text/plain' });
					res.end('Server error');
					return true;
				}
			});

			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account: Account = await auth.login() as Account;
			expect(account.name).to.equal('test_client:foo@bar.com');
			expect(account.auth.tokens.access_token).to.equal(this.server.accessToken);
		});
	});

	describe('Logout', () => {
		afterEach(stopLoginServer);

		it('should log out', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				expiresIn: 10,
				token(post: any) {
					switch (++counter) {
						case 1:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.ClientCredentials);
							break;

						case 2:
							expect(post.grant_type).to.equal(Authenticator.GrantTypes.RefreshToken);
							expect(post.refresh_token).to.equal(this.server.refreshToken);
							break;
					}
				}
			});

			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const account: Account = await auth.login() as Account;
			const revoked = await auth.logout({ accounts: account.name });
			expect(revoked).to.have.lengthOf(1);
		});

		it('should not error logging out if not logged in', async function () {
			let counter = 0;

			this.server = await createLoginServer({
				logout() {
					counter++;
				}
			});

			const auth = new Auth({
				secretFile:     path.join(__dirname, 'resources', 'rsa-private.pem'),
				baseUrl:        'http://127.0.0.1:1337',
				clientId:       'test_client',
				realm:          'test_realm',
				tokenStoreType: 'memory'
			});

			const revoked = await auth.logout({ accounts: 'test_client:foo@bar.com' });
			expect(revoked).to.have.lengthOf(0);
			expect(counter).to.equal(0);
		});
	});
});
