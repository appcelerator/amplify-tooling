import fs from 'fs-extra';
import path from 'path';
import snooplogg from 'snooplogg';
import tmp from 'tmp';
import { createTelemetryServer, stopServer } from './common';
import { Telemetry } from '../dist/index';

const logger = snooplogg('test:amplify-sdk:telemetry');

tmp.setGracefulCleanup();

const cacheDir = tmp.tmpNameSync({ prefix: 'test-amplify-sdk-' });

describe.only('Telemetry', () => {
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
		afterEach(() => fs.removeSync(cacheDir));

		it('should not send if no events', async function () {
			this.timeout(5000);
			this.slow(4000);

			let counter = 0;
			this.server = await createTelemetryServer({
				onEvent() {
					counter++;
				}
			});

			const { appDir, telemetry } = createTelemetry();

			const files = fs.readdirSync(appDir);
			expect(files).to.have.lengthOf(1);
			expect(fs.readJsonSync(path.join(appDir, files[0])).event).to.equal('session.start');
			fs.removeSync(path.join(appDir, files[0]));

			telemetry.send();
			await new Promise(resolve => setTimeout(resolve, 2000));
			expect(counter).to.equal(0);
		});

		it('should add an event and send', async function () {
			this.timeout(5000);
			this.slow(4000);

			const posts = [];
			this.server = await createTelemetryServer({
				onEvent(payload) {
					posts.push(payload);
				}
			});

			const { appDir, telemetry } = createTelemetry();

			telemetry.addEvent({
				event: 'foo.bar',
				meaningOfLife: 42
			});

			let files = fs.readdirSync(appDir);
			expect(files).to.have.lengthOf(2);

			telemetry.send();
			await new Promise(resolve => setTimeout(resolve, 2000));

			expect(fs.readdirSync(appDir)).to.have.lengthOf(1);
			printDebugLog(appDir);

			expect(posts).to.have.lengthOf(1);
			const events = posts[0];
			expect(events).to.be.an('array');
			events.sort((a, b) => a.timestamp - b.timestamp);

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
			expect(files).to.have.lengthOf(16);

			telemetry.send();
			await new Promise(resolve => setTimeout(resolve, 2000));

			printDebugLog(appDir);

			expect(posts).to.have.lengthOf(2);

			let events = posts[0].sort((a, b) => {
				const d = a.timestamp - b.timestamp;
				return d !== 0 ? d : a.event.localeCompare(b.event);
			});
			expect(events).to.have.lengthOf(10);
			expect(events[0].event).to.equal('session.start');
			for (let i = 1; i < events.length; i++) {
				expect(events[i].event).to.equal(`test${i}`);
			}

			events = posts[1].sort((a, b) => {
				const d = a.timestamp - b.timestamp;
				return d !== 0 ? d : a.event.localeCompare(b.event);
			});
			expect(events).to.have.lengthOf(6);
			for (let i = 0; i < events.length; i++) {
				expect(events[i].event).to.equal(`test${i + 10}`);
			}
		});

		it('should add a crash event and send', async function () {
			//
		});

		it('should not add a crash event when not production', async function () {
			//
		});

		it('should not send if already sending????', async function () {
			// two sends a the same time
		});

		it('should not send bad event', async function () {
			//
		});

		it('should not remove event if failed to send', async function () {
			//
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

function printDebugLog(appDir) {
	const debugLogFile = path.join(appDir, 'debug.log');
	const { log } = logger('send-debug-log');
	if (fs.existsSync(debugLogFile)) {
		log(fs.readFileSync(debugLogFile, 'utf-8'));
	} else {
		log(`No debug log file: ${debugLogFile}`);
	}
}
