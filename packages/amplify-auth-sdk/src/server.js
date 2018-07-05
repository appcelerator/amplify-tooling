import E from './errors';
import http from 'http';
import querystring from 'querystring';
import snooplogg from 'snooplogg';

import { parse } from 'url';

const { log } = snooplogg('amplify-auth:server');

/**
 * Matches the incoming request as a authorization callback and selects the request id.
 *
 * @type {RegExp}
 */
const callbackRegExp = /^\/(callback)(?:\/([A-Z0-9]+))?/;

/**
 * A map of local HTTP server instances based on server id (hostname + port).
 *
 * @type {Object}
 */
const servers = {};

/**
 * Starts the server, if not already running.
 *
 * @param {Object} opts - Required options.
 * @param {String} opts.serverHost - The hostname to listen on.
 * @returns {Promise<Promise>} Resolves a promise once the server is started that resolves another
 * promise which resolves the auth code.
 */
export async function start({ getResponse, getToken, requestId, serverHost, serverPort, timeout }) {
	const serverId = `${serverHost}:${serverPort}`;

	if (!servers[serverId]) {
		// the server is not running, so create it
		// register the server
		servers[serverId] = {
			pending: new Map(),
			server: createServer(async (req, res) => {
				const url = parse(req.url);
				const m = url.pathname.match(callbackRegExp);
				let stopServer = false;

				try {
					if (m && m[1] === 'callback') {
						const { code } = querystring.parse(url.query);
						const id = m[2];
						const request = servers[serverId].pending.get(id);

						if (!code) {
							throw new Error('Invalid auth code');
						}

						if (!request) {
							throw new Error('Invalid Request ID');
						}

						log(`Request ${id} received auth code ${code}, clearing timeout and request`);
						clearTimeout(request.timer);
						servers[serverId].pending.delete(requestId);
						stopServer = true;

						// we do an inner try/catch because the request is valid, but auth could
						// still fail
						try {
							log(`Getting token using code: ${code}`);
							const accessToken = await getToken(code);
							request.resolve({ accessToken });

							const { contentType, message } = getResponse(req, 'interactiveSuccess');
							log(`[${serverId}] 200 ${url.pathname} (${m[2]})`);
							res.writeHead(200, { 'Content-Type': contentType });
							res.end(message);
						} catch (e) {
							request.reject(e);
							throw e;
						}
					} else {
						log(`[${serverId}] 404 ${url.pathname}`);
						const err = new Error('Not Found');
						err.status = 404;
						throw err;
					}
				} catch (e) {
					log(`[${serverId}] 400 ${url.pathname}`);
					log(e);

					const { contentType, message } = getResponse(req, e);
					res.writeHead(e.status || 400, { 'Content-Type': contentType });
					res.end(message);
				} finally {
					if (stopServer) {
						stop(false, serverId);
					}
				}
			})
		};

		await new Promise((resolve, reject) => {
			servers[serverId].server
				.on('listening', () => {
					log('Local HTTP server started');
					resolve();
				})
				.on('error', reject)
				.listen(serverPort);
		});
	}

	// set up the timer to stop the server
	const timer = setTimeout(() => {
		if (servers[serverId]) {
			const { pending } = servers[serverId];
			const request = pending.get(requestId);
			if (request) {
				log(`Request ${requestId} timed out`);
				pending.delete(requestId);
				request.reject(E.AUTH_TIMEOUT('Authentication timed out'));
			}
			stop(false, serverId);
		}
	}, timeout);

	return {
		async cancel() {
			const request = servers[serverId] && servers[serverId].pending.get(requestId);
			if (request) {
				log(`Cancelling request ${requestId}`);
				clearTimeout(request.timer);
				servers[serverId].pending.delete(requestId);
				await stop(false, serverId);
			}
		},
		promise: new Promise((resolve, reject) => {
			servers[serverId].pending.set(requestId, { resolve, reject, timer });
		})
	};
}

/**
 * Stops the HTTP server used for interactive authentication.
 *
 * @param {Boolean} [force] - When `true`, removes all pending requests and stops the local HTTP
 * server.
 * @param {String|Array.<String>} [serverIds] - A server id of a specific HTTP server or a list of
 * specific server ids to stop. Defaults to all active servers.
 * @returns {Promise}
 */
export async function stop(force, serverIds) {
	if (!serverIds) {
		serverIds = Object.keys(servers);
	} else if (!Array.isArray(serverIds)) {
		serverIds = [ serverIds ];
	}

	for (const serverId of serverIds) {
		const { server, pending } = servers[serverId] || {};

		if (server && (force || !pending.size)) {
			// null the server ref asap
			delete servers[serverId];

			log('Destroying local HTTP server...');
			await server.destroy();
			log('Local HTTP server stopped');

			// we need to notify all pending logins that the server was shut down
			const err = new Error('Server stopped');
			for (const [ id, { reject } ] of pending.entries()) {
				log(`Rejecting request ${id}`);
				reject(err);
			}
		}
	}
}

/**
 * Creates an HTTP server with connection management.
 *
 * @param {Function} handler - A function that process incoming requests.
 * @returns {http.Server}
 */
function createServer(handler) {
	const connections = {};
	const server = http.createServer(handler);

	server.on('connection', function (conn) {
		const key = `${conn.remoteAddress}:${conn.remotePort}`;
		connections[key] = conn;
		conn.on('close', () => {
			delete connections[key];
		});
	});

	server.destroy = function destroy() {
		const p = new Promise(resolve => server.close(resolve));
		for (const conn of Object.values(connections)) {
			conn.destroy();
		}
		return p;
	};

	return server;
}
