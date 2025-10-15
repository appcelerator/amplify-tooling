import bodyParser from 'koa-bodyparser';
import Koa from 'koa';
import Router from '@koa/router';
import snooplogg from 'snooplogg';
import { createAuthRoutes } from './auth-routes.js';
import { createPlatformRoutes } from './platform-routes.js';

const { log } = snooplogg.config({
	minBrightness: 80,
	maxBrightness: 210,
	theme: 'detailed'
})('test:servers');

function createServer({ port }) {
	return new Promise((resolve, reject) => {
		const app = new Koa();
		const router = new Router();

		app.use(bodyParser());
		app.use(async (ctx, next) => {
			log(`Incoming request: ${snooplogg.styles.highlight(`${ctx.method} ${ctx.url}`)}`);
			await next();
		});
		app.use(router.routes())


		const server = app.listen(port, '127.0.0.1');
		server.__connections = {};
		server.router = router;

		server.on('connection', conn => {
			const key = conn.remoteAddress + ':' + conn.remotePort;
			log(`${snooplogg.styles.highlight(key)} connected`);
			server.__connections[key] = conn;
			conn.on('close', () => {
				delete server.__connections[key];
				log(`${snooplogg.styles.highlight(key)} disconnected`);
			});
		});
		server.on('listening', () => {
			log(`Started test server: http://127.0.0.1:${port}`);
			resolve(server);
		});
		server.on('error', reject);
	});
}

export async function startAuthServer(opts = {}) {
	const server = await createServer({ port: 8555 });
	await createAuthRoutes(server, opts);
	return server;
}

export async function startPlatformServer(opts = {}) {
	const server = await createServer({ port: 8666 });
	await createPlatformRoutes(server, opts);
	return server;
}

export async function startServers() {
	const state = {};
	return [
		await startAuthServer({ state }),
		await startPlatformServer({ state })
	];
}

export async function stopServers() {
	this.timeout(10000);

	if (this.servers) {
		log(`Stopping ${this.servers.length} server${this.servers.length === 1 ? '' : 's'}...`);
		for (const server of this.servers) {
			for (const conn of Object.values(server.__connections)) {
				conn.destroy();
			}
			await new Promise(resolve => server.close(resolve));
		}
		this.servers = null;
	}
}

export function resetServers(data) {
	for (const server of this.servers || []) {
		server.resetState(data);
	}
}
