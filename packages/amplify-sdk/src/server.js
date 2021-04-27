import crypto from 'crypto';
import E from './errors';
import ejs from 'ejs';
import fs from 'fs-extra';
import getPort from 'get-port';
import http from 'http';
import path from 'path';
import snooplogg from 'snooplogg';

const { error, log } = snooplogg('amplify-auth:server');
const { green, highlight, red } = snooplogg.styles;

const defaultPort = 3000;
const defaultTimeout = 120000; // 2 minutes

/**
 * An HTTP server to listen for redirect callbacks.
 */
export default class Server {
	/**
	 * Initializes the server.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Number} [opts.timeout] - The number of milliseconds to wait before timing out.
	 * @access public
	 */
	constructor(opts = {}) {
		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected options to be an object');
		}

		this.pending = new Map();
		this.port = null;
		this.server = null;
		this.serverURL = null;
		this.timeout = opts.timeout || defaultTimeout;
	}

	/**
	 * Creates a callback URL.
	 *
	 * @param {Function} [handler] - A response handler for a request callback.
	 * @returns {Promise}
	 * @access public
	 */
	async createCallback(handler) {
		const requestId = crypto.randomBytes(4).toString('hex').toUpperCase();

		log(`Creating callback: ${requestId}`);

		await this.createServer();

		return {
			cancel: async () => {
				const request = this.pending.get(requestId);
				if (request) {
					log(`Cancelling request ${highlight(requestId)}`);
					clearTimeout(request.timer);
					this.pending.delete(requestId);
					await this.stop();
				}
			},
			start: () => new Promise((resolve, reject) => {
				this.pending.set(requestId, {
					handler,
					resolve,
					reject,
					timer: setTimeout(() => {
						const request = this.pending.get(requestId);
						if (request) {
							log(`Request ${highlight(requestId)} timed out`);
							this.pending.delete(requestId);
							request.reject(E.AUTH_TIMEOUT('Authentication failed: Timed out'));
						}
						this.stop();
					}, this.timeout)
				});
			}),
			url: `${this.serverURL}/callback/${requestId}`
		};
	}

	/**
	 * Creates the server if it's not already created.
	 *
	 * @returns {Promise}
	 * @access private
	 */
	async createServer() {
		if (this.server) {
			return;
		}

		const host = 'localhost'; // this has to be localhost because platform whitelists it
		const port = this.port = this.port || await getPort({ host, port: defaultPort });
		const connections = {};
		const callbackRegExp = /^\/callback\/([A-Z0-9]+)/;
		const serverURL = `http://${host}:${port}`;

		this.serverURL = serverURL;

		await new Promise((resolve, reject) => {
			this.server = http.createServer(async (req, res) => {
				const url = new URL(req.url, serverURL);
				let id;
				let request;
				log(`Incoming request: ${highlight(url.pathname)}`);

				try {
					const m = url.pathname.match(callbackRegExp);
					if (!m) {
						throw new Error('Bad Request');
					}

					id = m[1];
					request = this.pending.get(id);
					if (!request) {
						throw new Error('Invalid Request ID');
					}

					let head = false;
					const origWriteHead = res.writeHead;
					res.writeHead = function (status, message, headers) {
						head = true;
						log(`${(status >= 400 ? red : green)(String(status))} ${url.pathname} (${id})`, headers?.Location ? `Redirecting to ${headers.Location}` : '');
						return origWriteHead.call(res, status, message, headers);
					};

					let end = false;
					const origEnd = res.end;
					res.end = function (data, encoding, callback) {
						end = true;
						return origEnd.call(res, data, encoding, callback);
					};

					if (typeof request.handler === 'function') {
						await request.handler(req, res);
					}

					if (!end) {
						if (head) {
							// assume no body
							res.end();
						} else {
							res.writeHead(200, { 'Content-Type': 'text/plain' });
							res.end('OK');
						}
					}

					clearTimeout(request.timer);
					this.pending.delete(id);
					request.resolve(url);
				} catch (err) {
					log(`${red(err.status || '400')} ${url.pathname}`);
					error(err);

					res.writeHead(err.status || 400, { 'Content-Type': 'text/html' });
					const template = path.resolve(__dirname, '../templates/error.html.ejs');
					res.end(ejs.render(await fs.readFile(template, 'utf-8'), {
						title: 'Error',
						message: err.message
					}));

					if (request) {
						clearTimeout(request.timer);
						this.pending.delete(id);
						request.reject(err);
					}
				}
			});

			this.server.destroy = function destroy() {
				for (const conn of Object.values(connections)) {
					conn.destroy();
				}
				return new Promise(resolve => this.close(resolve));
			};

			this.server
				.on('connection', function (conn) {
					const key = `${conn.remoteAddress}:${conn.remotePort}`;
					connections[key] = conn;
					conn.on('close', () => {
						delete connections[key];
					});
				})
				.on('error', reject)
				.on('listening', () => {
					log(`Local HTTP server started: ${highlight(serverURL)}`);
					resolve();
				})
				.listen(port, host);
		});
	}

	/**
	 * Stops the callback server.
	 *
	 * @param {Boolean} [force] - When `true`, stops the server, drops all connections, and rejects
	 * all pending callbacks.
	 * @returns {Promise}
	 * @memberof Server
	 */
	async stop(force) {
		if (force || this.pending.size === 0) {
			const { server } = this;
			if (server) {
				this.port = null;
				this.server = null;
				this.serverURL = null;
				log('Destroying local HTTP server...');
				await server.destroy();
				log('Local HTTP server stopped');
			}

			// we need to notify all pending logins that the server was shut down
			const err = new Error('Server stopped');
			for (const [ id, { reject, timer } ] of this.pending.entries()) {
				log(`Rejecting request ${highlight(id)}`);
				clearTimeout(timer);
				reject(err);
				this.pending.delete(id);
			}
		}
	}
}
