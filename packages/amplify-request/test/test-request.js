import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import request, { requestJSON, requestStream } from '../dist';

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

	it('should error if params is not an object', done => {
		request('foo')
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected options to be an object');
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
				.then((response) => {
					expect(response.statusCode).to.equal(200);
					expect(response.body).to.equal('foo!');
					done();
				}).catch(done);
		});
	});

	it('should reject with the error', done => {
		request({ url: 'http://127.0.0.1:1337' })
			.then(({ response, body }) => {
				done(new Error('Expected an error'));
			}).catch(err => {
				expect(err.code).to.equal('ECONNREFUSED');
				done();
			});
	});

	it('should throw on non-2xx reponses', function (done) {
		this.server = http.createServer((req, res) => {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('Not Found');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({ url: 'http://127.0.0.1:1337' })
				.then(() => {
					done(new Error('Expected a failure'));
				}).catch((response) => {
					expect(response.statusCode).to.equal(404);
					expect(response.error).to.equal('Not Found');
					done();
				});
		});
	});

	it('should throw when getting ECONNREFUSED', function (done) {
		request({ url: 'http://127.0.0.1:1336' })
			.then(() => {
				done(new Error('Expected a failure'));
			}).catch((response) => {
				expect(response.code).to.equal('ECONNREFUSED');
				expect(response.message).to.equal('connect ECONNREFUSED 127.0.0.1:1336');
				done();
			});
	});

	it('should make https request without strict ssl', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.writeHead(200, { 'Content-Length': 4 });
			res.end('foo!');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				strictSSL: false,
				url: 'https://127.0.0.1:1337'
			}).then((response) => {
				try {
					expect(response.statusCode).to.equal(200);
					expect(parseInt(response.headers['content-length'])).to.equal(4);
					expect(response.body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});

	it('should fail making https request with network.strictSSL set to true', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.end('foo!');
		});
		const config = new MockConfig({
			'network.strictSSL': true
		});
		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'https://127.0.0.1:1337',
				config
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

	it('should support network.strictSSL config setting', function (done) {
		this.server = https.createServer({
			key: fs.readFileSync(path.join(sslDir, 'server.key.pem')),
			cert: fs.readFileSync(path.join(sslDir, 'server.chain.pem'))
		}, (req, res) => {
			res.end('foo!');
		});
		const config = new MockConfig({
			'network.strictSSL': true
		});
		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'https://127.0.0.1:1337',
				config
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

	it('should support network.caFile/certFile/keyFile config setting', function (done) {
		this.timeout(5000);
		this.slow(4000);

		const config = new MockConfig({
			'network.caFile': path.join(sslDir, 'ca.crt.pem'),
			'network.certFile': path.join(sslDir, 'client.crt.pem'),
			'network.keyFile': path.join(sslDir, 'client.key.pem'),
			'network.strictSSL': false
		});

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

		this.server.listen(1337, '127.0.0.1', () => {
			request({
				url: 'https://127.0.0.1:1337',
				config
			}).then(response => {
				try {
					expect(response.statusCode).to.equal(200);
					expect(parseInt(response.headers['content-length'])).to.equal(4);
					expect(response.body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			}).catch(err => {
				done(err);
			});
		});
	});

	it('should support network.httpProxy config setting', function (done) {
		this.timeout(5000);
		this.slow(4000);
		const config = new MockConfig({
			'network.httpProxy': 'http://127.0.0.1:1337'
		});
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
			request({
				url: 'http://127.0.0.1:1338',
				config
			}).then((response) => {
				try {
					expect(response.statusCode).to.equal(200);
					expect(parseInt(response.headers['content-length'])).to.equal(4);
					expect(response.body).to.equal('foo!');
					done();
				} catch (e) {
					done(e);
				}
			}).catch(err => {
				done(err);
			});
		});
	});

	it('should support network.httpsProxy config setting', function (done) {
		this.timeout(5000);
		this.slow(4000);

		const config = new MockConfig({
			'network.httpsProxy': 'https://127.0.0.1:1338'
		});

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
				request({
					url: 'https://127.0.0.1:1337',
					config,
					tunnel: false,
					strictSSL: false
				}).then((response) => {
					try {
						expect(response.statusCode).to.equal(200);
						expect(parseInt(response.headers['content-length'])).to.equal(4);
						expect(response.body).to.equal('foo!');
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

describe('requestJSON', () => {
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
		requestJSON('foo')
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected options to be an object');
				done();
			})
			.catch(done);
	});

	it('should allow fetching JSON', function (done) {
		this.server = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('{ "foo": true }');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({ url: 'http://127.0.0.1:1337' })
				.then((response) => {
					expect(response.statusCode).to.equal(200);
					expect(response.body).to.deep.equal({ foo: true });
					done();
				}).catch(done);
		});
	});

	it('should throw on non-2xx reponses', function (done) {
		this.server = http.createServer((req, res) => {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('Not Found');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({ url: 'http://127.0.0.1:1337' })
				.then(() => {
					done(new Error('Expected a failure'));
				}).catch((response) => {
					expect(response.statusCode).to.equal(404);
					expect(response.error).to.equal('Not Found');
					done();
				});
		});
	});

	it('should throw if the response is invalid JSON', function (done) {
		this.server = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end('{{{{{{{{{');
		});

		this.server.listen(1337, '127.0.0.1', () => {
			requestJSON({ url: 'http://127.0.0.1:1337' })
				.then(() => {
					done(new Error('Expected a failure'));
				}).catch((response) => {
					expect(response.code).to.equal('INVALID_JSON');
					expect(response.message).to.equal('Invalid JSON response at http://127.0.0.1:1337 Unexpected token { in JSON at position 1');
					done();
				});
		});
	});

	it('should throw when getting ECONNREFUSED', function (done) {
		requestJSON({ url: 'http://127.0.0.1:1336' })
			.then(() => {
				done(new Error('Expected a failure'));
			}).catch((response) => {
				expect(response.code).to.equal('ECONNREFUSED');
				expect(response.message).to.equal('connect ECONNREFUSED 127.0.0.1:1336');
				done();
			});
	});
});

describe('requestStream', () => {
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
		requestStream('foo')
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected options to be an object');
				done();
			})
			.catch(done);
	});

	it('should error if callback is not a function', done => {
		requestStream({}, 'foo')
			.then(() => {
				done(new Error('Expected error'));
			})
			.catch(err => {
				expect(err).to.be.an.instanceof(TypeError);
				expect(err.message).to.equal('Expected callback to be a function');
				done();
			})
			.catch(done);
	});

	it('should make a request', function (done) {
		this.server = http.createServer((req, res) => {
			res.end('foo!');
		});
		this.server.listen(1337, '127.0.0.1', () => {
			requestStream({
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
