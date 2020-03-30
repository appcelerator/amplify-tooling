import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import request, { requestFile } from '../dist';

const sslDir = path.join(__dirname, 'fixtures', 'ssl');

class MockConfig {
	constructor(keyValues) {
		for (const [ key, value ] of Object.entries(keyValues)) {
			this[key] = value;
		}
	}
	get(key) {
		if (this[key] !== undefined) {
			return this[key];
		}
		return undefined;
	}
}

describe('request', () => {
	beforeEach(function () {
		this.server = null;
		this.server2 = null;
	});

	afterEach(function (done) {
		if (this.server) {
			this.server.close(() => {
				if (this.server2) {
					this.server2.close(() => done());
				} else {
					done();
				}
			});
		} else {
			done();
		}
	});

	it('should error if params is not an object', async () => {
		try {
			await request('foo');
		} catch (err) {
			expect(err).to.be.an.instanceof(TypeError);
			expect(err.message).to.equal('Expected options to be an object');
			return;
		}

		throw new Error('Expected error');
	});

	it('should make http request', async function () {
		this.server = http.createServer((req, res) => res.end('foo!'));

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		const response = await request({ url: 'http://127.0.0.1:1337' });
		expect(response.statusCode).to.equal(200);
		expect(response.body).to.equal('foo!');
	});

	it('should reject with the error', async function () {
		this.timeout(5000);

		try {
			const r = await request({ url: 'http://127.0.0.1:1337' });
		} catch (err) {
			expect(err.code).to.equal('ECONNREFUSED');
			return;
		}

		throw new Error('Expected an error');
	});

	it('should throw on non-2xx reponses', async function () {
		this.server = http.createServer((req, res) => {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('Not Found');
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		try {
			await request({ url: 'http://127.0.0.1:1337' });
		} catch (err) {
			expect(err.statusCode).to.equal(404);
			expect(err.error).to.equal('Not Found');
			return;
		}

		throw new Error('Expected a failure');
	});

	it('should throw when getting ECONNREFUSED', async function () {
		this.timeout(5000);

		try {
			await request({ url: 'http://127.0.0.1:1336' });
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
			await request({ url: 'http://127.0.0.1:1337', validateJSON: true });
		} catch (err) {
			expect(err.code).to.equal('INVALID_JSON');
			expect(err.message).to.equal('Invalid JSON response at http://127.0.0.1:1337 Unexpected token { in JSON at position 1');
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

		const response = await request({
			strictSSL: false,
			url: 'https://127.0.0.1:1337'
		});

		expect(response.statusCode).to.equal(200);
		expect(parseInt(response.headers['content-length'])).to.equal(4);
		expect(response.body).to.equal('foo!');
	});

	it('should fail making https request with network.strictSSL set to true', async function () {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.end('foo!');
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		try {
			await request({
				url: 'https://127.0.0.1:1337',
				config: new MockConfig({ 'network.strictSSL': true })
			});
		} catch (err) {
			expect(err.message).to.match(/self signed/);
			return;
		}
	});

	it('should support network.strictSSL config setting', async function () {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.end('foo!');
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		try {
			await request({
				url: 'https://127.0.0.1:1337',
				config: new MockConfig({ 'network.strictSSL': true })
			});
		} catch (err) {
			expect(err.message).to.match(/self signed/);
			return;
		}

		throw new Error('Expected error');
	});

	it('should support network.caFile/certFile/keyFile config setting', async function () {
		this.timeout(5000);
		this.slow(4000);

		this.server = https.createServer({
			ca: fs.readFileSync(path.join(sslDir, 'ca.crt.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.crt.pem')),
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			requestCert: true
		}, (req, res) => {
			if (!req.client.authorized) {
				res.writeHead(401, { 'Content-Type': 'text/plain' });
				res.end('Client cert required');
				return;
			}

			let cert = req.connection.getPeerCertificate();
			if (!cert || !Object.keys(cert).length) {
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('Client cert was authenticated, but no cert!');
				return;
			}

			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		const response = await request({
			url: 'https://127.0.0.1:1337',
			config: new MockConfig({
				'network.caFile': path.join(sslDir, 'ca.crt.pem'),
				'network.certFile': path.join(sslDir, 'client.crt.pem'),
				'network.keyFile': path.join(sslDir, 'client.key.pem'),
				'network.strictSSL': false
			})
		});

		expect(response.statusCode).to.equal(200);
		expect(parseInt(response.headers['content-length'])).to.equal(4);
		expect(response.body).to.equal('foo!');
	});

	it('should support network.httpProxy config setting', async function () {
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

		const response = await request({
			url: 'http://127.0.0.1:1338',
			config: new MockConfig({ 'network.httpProxy': 'http://127.0.0.1:1337' })
		});

		expect(response.statusCode).to.equal(200);
		expect(parseInt(response.headers['content-length'])).to.equal(4);
		expect(response.body).to.equal('foo!');
	});

	it('should support network.httpsProxy config setting', async function () {
		this.timeout(5000);
		this.slow(4000);

		this.server = https.createServer({
			ca: fs.readFileSync(path.join(sslDir, 'ca.crt.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.crt.pem')),
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem'))
		}, (req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		this.server2 = https.createServer({
			ca: fs.readFileSync(path.join(sslDir, 'ca.crt.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.crt.pem')),
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem'))
		}, (req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		await Promise.all([
			new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve)),
			new Promise(resolve => this.server2.listen(1338, '127.0.0.1', resolve))
		]);

		const response = await request({
			url: 'https://127.0.0.1:1337',
			config: new MockConfig({
				'network.httpsProxy': 'https://127.0.0.1:1338'
			}),
			tunnel: false,
			strictSSL: false
		});

		expect(response.statusCode).to.equal(200);
		expect(parseInt(response.headers['content-length'])).to.equal(4);
		expect(response.body).to.equal('foo!');
	});
});

describe('requestFile', () => {
	beforeEach(function () {
		this.server = null;
		this.server2 = null;
	});

	afterEach(function (done) {
		if (this.server) {
			this.server.close(() => {
				if (this.server2) {
					this.server2.close(() => done());
				} else {
					done();
				}
			});
		} else {
			done();
		}
	});

	it('should error if params is not an object', done => {
		try {
			requestFile('foo');
			done(new Error('Expected error'));
		} catch (error) {
			expect(error).to.be.an.instanceof(TypeError);
			expect(error.message).to.equal('Expected options to be an object');
			done();
		}
	});

	it('should error if callback is not a function', done => {
		try {
			requestFile({}, 'foo');
			done(new Error('Expected error'));
		} catch (error) {
			expect(error).to.be.an.instanceof(TypeError);
			expect(error.message).to.equal('Expected callback to be a function');
			done();
		}
	});

	it('should make a request', function (done) {
		this.server = http.createServer((req, res) => {
			res.end('foo!');
		});
		this.server.listen(1337, '127.0.0.1', () => {
			requestFile({
				url: 'http://127.0.0.1:1337'
			}, (err, response, body) => {
				try {
					if (err) {
						throw err;
					}
					expect(response.statusCode).to.equal(200);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});
});
