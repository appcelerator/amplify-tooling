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

	it('should default to a url', () => {
		const r = new Registry();
		expect(r.url).to.equal('https://registry.platform.axway.com');
	});

	it('should allow an override url to be passed in', () => {
		const r = new Registry({ url: 'http://127.0.0.1:8080' });
		expect(r.url).to.equal('http://127.0.0.1:8080');
	});

	it('should use a specific env', () => {
		const r = new Registry({ env: 'preprod' });
		expect(r.url).to.equal('https://registry.axwaytest.net');
	});

	it('should allow an override environment-derived url', () => {
		const r = new Registry({ env: 'preprod', url: 'http://127.0.0.1:8080' });
		expect(r.url).to.equal('http://127.0.0.1:8080');
	});

	it('metadata() should require name', () => {
		const r = new Registry({ url: 'http://127.0.0.1:1337' });
		return expect(r.metadata()).to.be.rejectedWith(TypeError, 'Expected name to be a valid string');
	});

	it('metadata() should allow querying for metadata by name', async function () {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		const reg = new Registry({ url: 'http://127.0.0.1:1337' });
		const data = await reg.metadata({ name: 'foo' });
		expect(data).to.deep.equal({ name: 'foo' });
	});

	it('metadata() should allow querying for metadata by name and version', async function () {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		const reg = new Registry({ url: 'http://127.0.0.1:1337' });
		const data = await reg.metadata({ name: 'foo', version: '1.2.3' });
		expect(data).to.deep.equal({ name: 'foo' });
	});

	it('search() should allow searching by just text', async function () {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		const reg = new Registry({ url: 'http://127.0.0.1:1337' });
		const data = await reg.search({ text: 'foo' });
		expect(data).to.deep.equal({ name: 'foo' });
	});

	it('search() should allow searching with repository', async function () {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		const reg = new Registry({ url: 'http://127.0.0.1:1337' });
		const data = await reg.search({ text: 'foo', repository: 'npm' });
		expect(data).to.deep.equal({ name: 'foo' });
	});

	it('metadata() should allow searching with type', async function () {
		this.server = http.createServer((req, res) => {
			res.end(JSON.stringify({ result: { name: 'foo' } }));
		});

		await new Promise(resolve => this.server.listen(1337, '127.0.0.1', resolve));

		const reg = new Registry({ url: 'http://127.0.0.1:1337' });
		const data = await reg.search({ text: 'foo', type: 'plugin' });
		expect(data).to.deep.equal({ name: 'foo' });
	});
});
