import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { createTelemetryServer, stopServer } from './common';
import { Telemetry } from '../dist/index';

tmp.setGracefulCleanup();

const cacheDir = tmp.tmpNameSync({ prefix: 'test-amplify-sdk-' });

describe('Telemetry', () => {
	describe('Error handling', () => {
		afterEach(() => fs.removeSync(cacheDir));

		it('should error if options are invalid', () => {
			expect(() => {
				new Telemetry();
			}).to.throw(TypeError, 'Expected telemetry options to be an object');

			expect(() => {
				new Telemetry(123);
			}).to.throw(TypeError, 'Expected telemetry options to be an object');
		});

		it('should error if app guid is invalid', () => {
			expect(() => {
				new Telemetry({});
			}).to.throw(TypeError, 'Expected app guid to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: '' });
			}).to.throw(TypeError, 'Expected app guid to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: 123 });
			}).to.throw(TypeError, 'Expected app guid to be a non-empty string');
		});

		it('should error if app version is invalid', () => {
			expect(() => {
				new Telemetry({ appGuid: 'foo' });
			}).to.throw(TypeError, 'Expected app version to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: '' });
			}).to.throw(TypeError, 'Expected app version to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: 123 });
			}).to.throw(TypeError, 'Expected app version to be a non-empty string');
		});

		it('should error if cache dir is invalid', () => {
			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: '1.0.0' });
			}).to.throw(TypeError, 'Expected telemetry cache dir to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: '1.0.0', cacheDir: '' });
			}).to.throw(TypeError, 'Expected telemetry cache dir to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: '1.0.0', cacheDir: 123 });
			}).to.throw(TypeError, 'Expected telemetry cache dir to be a non-empty string');
		});

		it('should error if environment is invalid', () => {
			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: '1.0.0', cacheDir: 'bar' });
			}).to.throw(TypeError, 'Expected environment to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: '1.0.0', cacheDir: 'bar', environment: '' });
			}).to.throw(TypeError, 'Expected environment to be a non-empty string');

			expect(() => {
				new Telemetry({ appGuid: 'foo', appVersion: '1.0.0', cacheDir: 'bar', environment: 123 });
			}).to.throw(TypeError, 'Expected environment to be a non-empty string');
		});

		it('should error if request options are invalid', () => {
			expect(() => {
				new Telemetry({
					appGuid: 'foo',
					appVersion: '1.0.0',
					cacheDir: 'bar',
					environment: 'test',
					requestOptions: 'baz'
				});
			}).to.throw(TypeError, 'Expected telemetry request options to be an object');

			expect(() => {
				new Telemetry({
					appGuid: 'foo',
					appVersion: '1.0.0',
					cacheDir: 'bar',
					environment: 'test',
					requestOptions: 123
				});
			}).to.throw(TypeError, 'Expected telemetry request options to be an object');
		});

		it('should error adding an event without a payload', () => {
			const { telemetry } = createTelemetry();

			expect(() => {
				telemetry.addEvent();
			}).to.throw(TypeError, 'Expected telemetry payload to be an object');

			expect(() => {
				telemetry.addEvent(123);
			}).to.throw(TypeError, 'Expected telemetry payload to be an object');

			expect(() => {
				telemetry.addEvent('foo');
			}).to.throw(TypeError, 'Expected telemetry payload to be an object');
		});

		it('should error adding an event without an event', () => {
			const { telemetry } = createTelemetry();

			expect(() => {
				telemetry.addEvent({});
			}).to.throw(TypeError, 'Expected telemetry payload to have an event name');

			expect(() => {
				telemetry.addEvent({ event: '' });
			}).to.throw(TypeError, 'Expected telemetry payload to have an event name');

			expect(() => {
				telemetry.addEvent({ event: 123 });
			}).to.throw(TypeError, 'Expected telemetry payload to have an event name');
		});

		it('should error adding an crash without a payload', () => {
			const { telemetry } = createTelemetry({ environment: 'production' });

			expect(() => {
				telemetry.addCrash();
			}).to.throw(TypeError, 'Expected crash payload to be an object');

			expect(() => {
				telemetry.addCrash(123);
			}).to.throw(TypeError, 'Expected crash payload to be an object');

			expect(() => {
				telemetry.addCrash('foo');
			}).to.throw(TypeError, 'Expected crash payload to be an object');
		});

		it('should error adding an crash without a message', () => {
			const { telemetry } = createTelemetry({ environment: 'production' });

			expect(() => {
				telemetry.addCrash({});
			}).to.throw(TypeError, 'Expected crash payload to have a message');

			expect(() => {
				telemetry.addCrash({ message: '' });
			}).to.throw(TypeError, 'Expected crash payload to have a message');

			expect(() => {
				telemetry.addCrash({ message: 123 });
			}).to.throw(TypeError, 'Expected crash payload to have a message');
		});

		it('should not add crash if not production', () => {
			const { telemetry } = createTelemetry();
			telemetry.addCrash();
		});
	});

	describe('Send events', () => {
		afterEach(stopServer);
		afterEach(() => {
			delete process.env.AXWAY_CLI;
			delete process.env.TELEMETRY_DISABLED;
			fs.removeSync(cacheDir);
		});

		it('should not send if no events', async function () {
			this.timeout(10000);
			this.slow(8000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry();

			expect(fs.readdirSync(appDir)).to.have.lengthOf(3); // .hid, .sid, session.start

			await telemetry.send({ wait: true });
			expect(posts).to.have.lengthOf(1);
			expect(posts[0]).to.have.lengthOf(1);
			expect(posts[0][0].event).to.equal('session.start');

			expect(fs.readdirSync(appDir)).to.have.lengthOf(3); // .hid, .sid, debug.log
			fs.removeSync(path.join(appDir, 'debug.log'));

			await telemetry.send({ wait: true });
			expect(fs.readdirSync(appDir)).to.have.lengthOf(3); // .hid, .sid, debug.log
		});

		it('should add an event and send', async function () {
			this.timeout(10000);
			this.slow(8000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			process.env.AXWAY_CLI = 'x.y.z';

			const { appDir, telemetry } = createTelemetry();

			telemetry.addEvent({
				event: 'foo.bar',
				meaningOfLife: 42
			});

			let files = fs.readdirSync(appDir);
			expect(files).to.have.lengthOf(4);

			telemetry.send();
			await new Promise(resolve => setTimeout(() => resolve(), 5000));
			expect(fs.readdirSync(appDir)).to.have.lengthOf(3);

			expect(posts).to.have.lengthOf(1);
			const events = posts[0];
			expect(events[0].event).to.equal('session.start');
			expect(events[1].event).to.equal('foo.bar');
			expect(events[1].data).to.deep.equal({ meaningOfLife: 42 });
		});

		it('should add many events and send 2 batches', async function () {
			this.timeout(5000);
			this.slow(4000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry();

			for (let i = 1; i <= 15; i++) {
				telemetry.addEvent({ event: `test${i}` });
			}

			const files = fs.readdirSync(appDir);
			expect(files).to.have.lengthOf(18);

			await telemetry.send({ wait: true });
			expect(fs.readdirSync(appDir)).to.have.lengthOf(3);
			expect(posts).to.have.lengthOf(2);

			let events = posts[0];
			expect(events).to.have.lengthOf(10);
			expect(events[0].event).to.equal('session.start');
			let counter = 1;
			for (let i = 1; i < events.length; i++) {
				expect(events[i].event).to.equal(`test${counter++}`);
			}

			events = posts[1];
			expect(events).to.have.lengthOf(6);
			for (let i = 0; i < events.length; i++) {
				expect(events[i].event).to.equal(`test${counter++}`);
			}
		});

		it('should add a crash event and send', async function () {
			this.timeout(5000);
			this.slow(4000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry({ environment: 'production' });

			telemetry.addCrash({ message: 'This is not an error' });
			telemetry.addCrash(new Error('This is an error'));

			class CustomError extends Error {
				constructor(message, code, data) {
					super(message);
					this.code = code;
					this.data = data;
					this.name = 'CustomError';
					this.stack = `${this.toString()}\n    at test-telemetry.js\n    at someFunction (/some/file.js)`;
				}
			}

			telemetry.addCrash(new CustomError('This is a custom error', 123, { foo: 'bar' }));

			const files = fs.readdirSync(appDir);
			expect(files).to.have.lengthOf(6);

			await telemetry.send({ wait: true });
			expect(fs.readdirSync(appDir)).to.have.lengthOf(3);

			expect(posts).to.have.lengthOf(1);
			const events = posts[0];
			expect(events).to.have.lengthOf(4);
			expect(events[0].event).to.equal('session.start');

			expect(events[1].event).to.equal('crash.report');
			expect(events[1].data).to.deep.equal({
				message: 'This is not an error'
			});

			expect(events[2].event).to.equal('crash.report');
			expect(events[2].data).to.be.an('object');
			expect(events[2].data.name).to.equal('Error');
			expect(events[2].data.message).to.equal('This is an error');
			expect(events[2].data.stack).to.match(/^Error: This is an error/);

			expect(events[3].event).to.equal('crash.report');
			expect(events[3].data).to.be.an('object');
			expect(events[3].data.code).to.equal(123);
			expect(events[3].data.data).to.deep.equal({ foo: 'bar' });
			expect(events[3].data.name).to.equal('CustomError');
			expect(events[3].data.message).to.equal('This is a custom error');
			expect(events[3].data.stack).to.match(/^CustomError: This is a custom error/);
		});

		it('should not add a crash event when not production', async function () {
			this.timeout(5000);
			this.slow(4000);

			const { appDir, telemetry } = createTelemetry();
			telemetry.addCrash(new Error('This is an error'));
			expect(fs.readdirSync(appDir)).to.have.lengthOf(3);
		});

		it('should not send if already sending', async function () {
			this.timeout(10000);
			this.slow(8000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry();

			telemetry.addEvent({ event: 'foo.bar' });

			expect(fs.readdirSync(appDir)).to.have.lengthOf(4);

			await Promise.all([
				telemetry.send({ wait: true }),
				telemetry.send({ wait: true })
			]);

			expect(posts).to.have.lengthOf(1);
			const events = posts[0];
			expect(events[0].event).to.equal('session.start');
			expect(events[1].event).to.equal('foo.bar');
		});

		it('should override a stale pid', async function () {
			this.timeout(10000);
			this.slow(8000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry();

			telemetry.addEvent({ event: 'foo.bar' });

			// we need to find a pid that doesn't actually exist
			let luckyPid;
			while (true) {
				luckyPid = Math.floor(10000 + Math.random() * 50000);
				try {
					process.kill(luckyPid, 0);
					// try again :(
				} catch (e) {
					// bingo!
					fs.writeFileSync(path.join(appDir, '.lock'), String(luckyPid));
					break;
				}
			}

			await telemetry.send({ wait: true });

			expect(posts).to.have.lengthOf(1);
			const events = posts[0];
			expect(events[0].event).to.equal('session.start');
			expect(events[1].event).to.equal('foo.bar');
		});

		it('should not send bad events', async function () {
			this.timeout(10000);
			this.slow(8000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry();

			// send session.start
			await telemetry.send({ wait: true });

			expect(fs.readdirSync(appDir)).to.have.lengthOf(3);

			// write bad events
			fs.writeFileSync(path.join(appDir, 'a.json'), '{}');
			fs.writeFileSync(path.join(appDir, 'b.json'), '{{{{');
			expect(fs.readdirSync(appDir)).to.have.lengthOf(5);

			// nothing to send
			await telemetry.send({ wait: true });

			expect(fs.readdirSync(appDir)).to.have.lengthOf(3);

			expect(posts).to.have.lengthOf(1);
		});

		it('should not send if app directory does not exist', async function () {
			this.timeout(5000);
			this.slow(4000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry();
			fs.removeSync(appDir);

			await telemetry.send({ wait: true });

			expect(fs.existsSync(appDir)).to.equal(false);
		});

		it('should not remove event if failed to send', async function () {
			this.timeout(5000);
			this.slow(4000);

			const { appDir, telemetry } = createTelemetry({
				url: 'http://127.0.0.1:13372/does_not_exist'
			});

			telemetry.addEvent({ event: 'foo.bar' });
			expect(fs.readdirSync(appDir)).to.have.lengthOf(4);

			await telemetry.send({ wait: true });
			expect(fs.readdirSync(appDir)).to.have.lengthOf(5);
		});

		it('should end an old session and start a new one', async function () {
			this.timeout(10000);
			this.slow(8000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			let { appDir, telemetry } = createTelemetry();
			await telemetry.send({ wait: true });

			// rewrite the .sid to be expired
			const json = fs.readJsonSync(path.join(appDir, '.sid'));
			const { id } = json;
			json.ts = new Date(new Date(json.ts) - 72 * 60 * 60 * 1000).toISOString();
			fs.writeJsonSync(path.join(appDir, '.sid'), json);

			({ appDir, telemetry } = createTelemetry());
			expect(fs.readdirSync(appDir)).to.have.lengthOf(5);

			await telemetry.send({ wait: true });
			expect(fs.readdirSync(appDir)).to.have.lengthOf(3);

			expect(posts).to.have.lengthOf(2);
			const events = posts[1];
			expect(events[0].event).to.equal('session.end');
			expect(events[0].session.id).to.equal(id);
			expect(events[1].event).to.equal('session.start');
			expect(events[1].session.id).to.not.equal(id);
		});

		it('should start new session if sid is corrupt', async function () {
			this.timeout(5000);
			this.slow(4000);

			// eslint-disable-next-line no-unused-vars
			let { appDir, telemetry } = createTelemetry();

			for (const filename of fs.readdirSync(appDir)) {
				if (filename.endsWith('.json')) {
					fs.removeSync(path.join(appDir, filename));
				}
			}
			expect(fs.readdirSync(appDir)).to.have.lengthOf(2); // .hid, .sid

			let json = fs.readJsonSync(path.join(appDir, '.sid'));
			json.id = 'foo';
			fs.writeJsonSync(path.join(appDir, '.sid'), json);

			({ appDir, telemetry } = createTelemetry());
			expect(fs.readdirSync(appDir)).to.have.lengthOf(3); // .hid, .sid (new), session.start
			json = fs.readJsonSync(path.join(appDir, '.sid'));
			expect(json.id).to.not.equal('foo');
		});

		it('should not add events if telemetry is disabled', async function () {
			this.timeout(5000);
			this.slow(4000);

			process.env.TELEMETRY_DISABLED = '1';

			let { appDir, telemetry } = createTelemetry();
			expect(fs.readdirSync(appDir)).to.have.lengthOf(2);

			telemetry.addEvent({ event: 'foo.bar' });
			telemetry.addCrash(new Error('This is an error'));
			await telemetry.send({ wait: true });

			expect(fs.readdirSync(appDir)).to.have.lengthOf(2);
		});
	});
});

function createTelemetry(opts = {}) {
	const telemetry = new Telemetry({
		appGuid: 'foo',
		appVersion: '1.0.0',
		cacheDir,
		environment: 'test',
		url: 'http://127.0.0.1:13372/v4/event',
		...opts
	});

	const appDir = path.join(cacheDir, 'foo');
	expect(fs.existsSync(appDir)).to.equal(true);

	return {
		appDir,
		telemetry
	};
}
