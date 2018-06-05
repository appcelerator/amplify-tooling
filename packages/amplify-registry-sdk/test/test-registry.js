import http from 'http';
import Registry from '../dist/registry';

describe('Registry', function () {
	beforeEach(function () {
		this.server = null;
	});

	afterEach(function (done) {
		if (this.server) {
			this.server.close(() => {
				done();
			});
		} else {
			done();
		}
	});

	it('should default to a url', done => {
		const r = new Registry();
		expect(r.url).to.equal('http://localhost:8082');
		done();
	});

	it('should allow an override url to be passed in', done => {
		const r = new Registry({ url: 'http://localhost:8080' });
		expect(r.url).to.equal('http://localhost:8080');
		done();
	});

	it('metadata(): should require name', () => {
		const r = new Registry({ url: 'http://localhost:1337' });
		return expect(r.metadata()).to.be.rejectedWith(TypeError, 'Expected name to be a valid string');
	});

	it('metadata() should allow querying for metadata by name', function (done) {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});
		const r = new Registry({ url: 'http://localhost:1337' });

		this.server.listen(1337, '127.0.0.1', () => {
			r.metadata({ name: 'foo' })
				.then(data => {
					expect(data).to.deep.equal({ name: 'foo' });
					done();
				})
				.catch(done);
		});
	});

	it('metadata() should allow querying for metadata by name and version', function (done) {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});
		const r = new Registry({ url: 'http://localhost:1337' });

		this.server.listen(1337, '127.0.0.1', () => {
			r.metadata({ name: 'foo', version: '1.2.3' })
				.then(data => {
					expect(data).to.deep.equal({ name: 'foo' });
					done();
				})
				.catch(done);
		});
	});

	it('search() should require text', () => {
		const r = new Registry({ url: 'http://localhost:1337' });
		return expect(r.search()).to.be.rejectedWith(TypeError, 'Expected text to be a valid string');
	});

	it('search() should allow searching by just text', function (done) {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});
		const r = new Registry({ url: 'http://localhost:1337' });

		this.server.listen(1337, '127.0.0.1', () => {
			r.search({ text: 'foo' })
				.then(data => {
					expect(data).to.deep.equal({ name: 'foo' });
					done();
				})
				.catch(done);
		});
	});

	it('search(): should allow searching with repository', function (done) {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});
		const r = new Registry({ url: 'http://localhost:1337' });

		this.server.listen(1337, '127.0.0.1', () => {
			r.search({ text: 'foo', repositories: 'npm' })
				.then(data => {
					expect(data).to.deep.equal({ name: 'foo' });
					done();
				})
				.catch(done);
		});
	});

	it('metadata(): should allow searching with type', function (done) {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});
		const r = new Registry({ url: 'http://localhost:1337' });

		this.server.listen(1337, '127.0.0.1', () => {
			r.search({ text: 'foo', type: 'plugin' })
				.then(data => {
					expect(data).to.deep.equal({ name: 'foo' });
					done();
				})
				.catch(done);
		});
	});
});
