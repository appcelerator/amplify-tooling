import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import request, { requestJSON } from '../dist';

const sslDir = path.join(__dirname, 'fixtures', 'request', 'ssl');

describe.only('request', () => {
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
		request('foo')
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected params to be an object');
				done();
			})
			.catch(done);
	});

	it('should make http request', function (done) {
		this.server = http.createServer((req, res) => {
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({ url: 'http://127.0.0.1:1337' })
				.then(async (response) => {
					const body = response.body;
					expect(response.statusCode).to.equal(200);
					expect(body).to.equal('foo!');
					done();
				}).catch(done);
		});
	});

	it('should allow making a JSON request', function (done) {
		this.server = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('{ "foo": true }');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({ url: 'http://127.0.0.1:1337' })
				.then((response) => {
					// expect(response.status).to.equal(200);
					// expect(body).to.equal('foo!');
					done();
				}).catch(done);
		});
	});

	it('should reject with the error', done => {
		requestJSON({ url: 'http://127.0.0.1:1337' })
			.then(({ response, body }) => {
				done(new Error('Expected an error'));
			}).catch(err => {
				expect(err.code).to.equal('ECONNREFUSED');
				done();
			});
	});

	it.skip('should make https request without strict ssl', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({
				strictSSL: false,
				url: 'https://127.0.0.1:1337'
			}).then(({ response, body }) => {
				try {
					expect(response.statusCode).to.equal(200);
					expect(parseInt(response.headers['content-length'])).to.equal(4);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it.skip('should fail making https fetch with strict ssl', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.end('foo!');
		});
		process.env.AMPLIFY_NETWORK_STRICT_SSL = true;
		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({
				strictSSL: false,
				url: 'https://127.0.0.1:1337'
			}).then(() => {
				done(new Error('Expected error'));
			}).catch(err => {
				try {
					if (err) {
						expect(err.message).to.match(/self signed/);
						done();
					} else {
						done(new Error('Expected fetch to fail'));
					}
				} catch (e) {
					console.log('!!!!', e);
					done(e);
				}
			});
		});
	});

	// TODO: move to config
	it.skip('should support AMPLIFY_NETWORK_STRICT_SSL environment variable', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.end('foo!');
		});
		process.env.AMPLIFY_NETWORK_STRICT_SSL = true;
		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({
				strictSSL: false,
				url: 'https://127.0.0.1:1337'
			}).then(() => {
				done(new Error('Expected error'));
			}).catch(err => {
				try {
					if (err) {
						expect(err.message).to.match(/self signed/);
						done();
					} else {
						done(new Error('Expected fetch to fail'));
					}
				} catch (e) {
					console.log('!!!!', e);
					done(e);
				}
			});
		});
	});

	// TODO: move to config
	it.skip('should support AMPLIFY_NETWORK_CA_FILE environment variable', function (done) {
		this.timeout(5000);
		this.slow(4000);

		process.env.AMPLIFY_NETWORK_CA_FILE = path.join(sslDir, 'ca.crt.pem');

		this.server = https.createServer({
			certFile: path.join(__dirname, 'ssl', 'client.crt.pem'),
			keyFile: path.join(__dirname, 'ssl', 'client.key.pem')
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

		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({
				url: 'https://127.0.0.1:1337',
				strictSSL: false
			}).then(({ response, body }) => {
				try {
					expect(response.statusCode).to.equal(200);
					expect(parseInt(response.headers['content-length'])).to.equal(4);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			}).catch(err => {
				done(err);
			});
		});
	});

	// TODO: move to config/HTTP_PROXY
	it.skip('should support AMPLIFY_NETWORK_PROXY with HTTP proxy', function (done) {
		this.timeout(5000);
		this.slow(4000);
		process.env.AMPLIFY_NETWORK_PROXY = 'http://127.0.0.1:1337';

		this.server = http.createServer((req, res) => {
			if (req.headers.host === '127.0.0.1:1338') {
				res.writeHead(200, { 'Content-Length': 4 });
				res.end('foo!');
			} else {
				res.writeHead(400, { 'Content-Type': 'text/plain' });
				res.end('Wrong host!');
			}
		});

		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({
				url: 'http://127.0.0.1:1338'
			}).then(({ response, body }) => {
				try {
					expect(response.statusCode).to.equal(200);
					expect(parseInt(response.headers['content-length'])).to.equal(4);
					expect(body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			}).catch(err => {
				done(err);
			});
		});
	});

	// TODO: move to config/HTTPS_PROXY
	it.skip('should support AMPLIFY_NETWORK_PROXY with HTTPS proxy', function (done) {
		this.timeout(5000);
		this.slow(4000);

		process.env.AMPLIFY_NETWORK_PROXY = 'https://127.0.0.1:1337';

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

		Promise
			.all([
				new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve)),
				new Promise(resolve => this.server2.listen(1338, '127.0.0.1', resolve))
			])
			.then(() => {
				requestJSON({
					url: 'https://127.0.0.1:1337',
					strictSSL: false,
					tunnel: false
				}).then(({ response, body }) => {
					try {
						expect(response.statusCode).to.equal(200);
						expect(parseInt(response.headers['content-length'])).to.equal(4);
						expect(body).to.equal('foo!');
						done();
					} catch (e) {
						done(e);
					}
				}).catch(err => {
					done(err);
				});
			});
	});
});
