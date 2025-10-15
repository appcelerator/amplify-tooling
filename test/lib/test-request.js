import fs from 'fs';
import http from 'http';
import https from 'https';
import init from '../../dist/lib/request.js';
import path from 'path';
import nock from 'nock';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sslDir = path.join(__dirname, '../helpers/fixtures/request/ssl');

describe('request', () => {
	describe('init()', () => {
		beforeEach(function () {
			// Ensure nock isn't wired up for these tests as it breaks the proxies
			nock.restore();

			this.server = null;
			this.server2 = null;
		});

		afterEach(function (done) {
			// Ensure nock is wired back up for other tests
			nock.activate();

			if (!this.server) {
				return done();
			}

			this.server.close(() => {
				done();
			});
		});

		it('should error if params is not an object', () => {
			expect(() => init('foo')).to.throw(TypeError, 'Expected options to be an object');
		});

		it('should make http request', async function () {
			this.server = http.createServer((req, res) => res.end('foo!'));

			await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

			const response = await init()('http://127.0.0.1:1337');
			expect(response.statusCode).to.equal(200);
			expect(response.body).to.equal('foo!');
		});

		it('should reject on error', async function () {
			this.timeout(10000);

			try {
				await init()('http://127.0.0.1:1337');
			} catch (err) {
				expect(err.code).to.equal('ECONNREFUSED');
				return;
			}

			throw new Error('Expected an error');
		});

		it('should throw on non-2xx responses', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(404, { 'Content-Type': 'text/plain' });
				res.end('Not Found');
			});

			await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

			try {
				await init()('http://127.0.0.1:1337');
			} catch (err) {
				expect(err.response.statusCode).to.equal(404);
				expect(err.response.body).to.equal('Not Found');
			}
		});

		it('should throw when getting ECONNREFUSED', async function () {
			this.timeout(10000);

			try {
				await init()({ url: 'http://127.0.0.1:1336' });
			} catch (err) {
				expect(err.code).to.equal('ECONNREFUSED');
				expect(err.message).to.equal('connect ECONNREFUSED 127.0.0.1:1336');
				return;
			}

			throw new Error('Expected a failure');
		});

		it('should throw if the response is invalid JSON and validateJSON is true', async function () {
			this.server = http.createServer((req, res) => {
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('{{{{{{{{{');
			});

			await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

			try {
				await init()('http://127.0.0.1:1337', { responseType: 'json' });
			} catch (err) {
				expect(err.message).to.include('Expected property name or \'}\' in JSON');
				return;
			}

			throw new Error('Expected a failure');
		});

		it('should make https request without strict ssl', async function () {
			this.server = https.createServer({
				key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
				cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
			}, (req, res) => {
				res.writeHead(200, { 'Content-Length': 4 });
				res.end('foo!');
			});

			await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

			const response = await init()({
				strictSSL: false,
				url: 'https://127.0.0.1:1337'
			});

			expect(response.statusCode).to.equal(200);
			expect(parseInt(response.headers['content-length'])).to.equal(4);
			expect(response.body).to.equal('foo!');
		});

		it('should fail making https request with strictSSL set to true', async function () {
			this.server = https.createServer({
				key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
				cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
			}, (req, res) => {
				res.end('foo!');
			});

			await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

			try {
				await init({ strictSSL: true })('https://127.0.0.1:1337');
			} catch (err) {
				expect(err.message).to.match(/self-signed certificate in certificate chain/);
				return;
			}
		});

		it('should support caFile/certFile/keyFile config setting', async function () {
			this.timeout(5000);
			this.slow(4000);

			this.server = https.createServer({
				ca:          fs.readFileSync(path.join(sslDir, 'ca.crt.pem')),
				cert:        fs.readFileSync(path.join(sslDir, 'server.crt.pem')),
				key:         fs.readFileSync(path.join(sslDir, 'server.key.pem')),
				requestCert: true
			}, (req, res) => {
				if (!req.client.authorized) {
					res.writeHead(401, { 'Content-Type': 'text/plain' });
					res.end('Client cert required');
					return;
				}

				let cert = req.socket.getPeerCertificate();
				if (!cert || !Object.keys(cert).length) {
					res.writeHead(500, { 'Content-Type': 'text/plain' });
					res.end('Client cert was authenticated, but no cert!');
					return;
				}

				res.writeHead(200, { 'Content-Length': 4 });
				res.end('foo!');
			});

			await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

			const got = init({
				https: {
					certificateAuthority: fs.readFileSync(path.join(sslDir, 'ca.crt.pem')),
					certificate:          fs.readFileSync(path.join(sslDir, 'client.crt.pem')),
					key:                  fs.readFileSync(path.join(sslDir, 'client.key.pem')),
					rejectUnauthorized:   false
				}
			});

			const response = await got('https://127.0.0.1:1337');

			expect(response.statusCode).to.equal(200);
			expect(parseInt(response.headers['content-length'])).to.equal(4);
			expect(response.body).to.equal('foo!');
		});

		it('should support proxy config setting', async function () {
			this.timeout(5000);
			this.slow(4000);

			this.server = http.createServer((req, res) => {
				if (req.headers.host === '127.0.0.1:1338') {
					res.writeHead(200, { 'Content-Length': 4 });
					res.end('foo!');
				} else {
					res.writeHead(400, { 'Content-Type': 'text/plain' });
					res.end('Wrong host!');
				}
			});

			await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

			const got = init({ proxy: 'http://127.0.0.1:1337' });

			const response = await got('http://127.0.0.1:1338', { agent: { http: got.defaults.options.agent.http } });

			expect(response.statusCode).to.equal(200);
			expect(parseInt(response.headers['content-length'])).to.equal(4);
			expect(response.body).to.equal('foo!');
		});
	});
});
