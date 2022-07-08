import crypto from 'crypto';
import E from './errors.js';
import ejs from 'ejs';
import fs from 'fs-extra';
import getPort from 'get-port';
import http, { OutgoingHttpHeaders } from 'http';
import path from 'path';
import snooplogg from 'snooplogg';
import { fileURLToPath } from 'url';
import { Socket } from 'net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { error, log } = snooplogg('amplify-auth:server');
const { green, highlight, red } = snooplogg.styles;

const defaultPort = 3000;
const defaultTimeout = 120000; // 2 minutes

type RequestHandler = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => Promise<any>;

interface PendingHandler {
	handler: RequestHandler,
	resolve: (v: any) => void,
	reject: (e: Error) => void,
	timer: NodeJS.Timeout
}

interface ServerOptions {
	timeout?: number
}

interface CallbackServer extends http.Server {
	destroy: () => Promise<void>
}

export type CallbackResult = { result: any, url: string };

export interface CallbackHandle {
	cancel: () => Promise<void>,
	start: () => Promise<CallbackResult>,
	url: string
}

/**
 * An HTTP server to listen for redirect callbacks.
 */
export default class Server {
	pending: Map<string, PendingHandler>;
	port: number | null;
	server: CallbackServer | null;
	serverURL: string | null;
	timeout: number;

	/**
	 * Initializes the server.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Number} [opts.timeout=120000] - The number of milliseconds to wait before timing
	 * out.
	 * @access public
	 */
	constructor(opts: ServerOptions = {}) {
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
	async createCallback(handler: RequestHandler): Promise<CallbackHandle> {
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
			start: () => new Promise<{ result: any, url: string }>((resolve, reject) => {
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
	async createServer(): Promise<void> {
		if (this.server) {
			return;
		}

		const host = 'localhost'; // this has to be localhost because platform whitelists it
		const port = this.port = this.port || await getPort({ host, port: defaultPort });
		const connections: { [key: string]: Socket } = {};
		const callbackRegExp = /^\/callback\/([A-Z0-9]+)/;
		const serverURL = `http://${host}:${port}`;

		this.serverURL = serverURL;

		await new Promise<void>((resolve, reject) => {
			this.server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
				const url = new URL(req.url as string, serverURL);
				let request;
				log(`Incoming request: ${highlight(url.pathname)}`);

				const m = url.pathname.match(callbackRegExp);
				const id: string | null = m && m[1];

				try {
					if (!id) {
						throw new Error('Bad Request');
					}

					request = this.pending.get(id);
					if (!request) {
						throw new Error('Invalid Request ID');
					}

					let head = false;
					const origWriteHead = res.writeHead.bind(res);
					res.writeHead = function (status: number, message: string, headers: OutgoingHttpHeaders) {
						head = true;
						log(`${(status >= 400 ? red : green)(String(status))} ${url.pathname} (${id})`);
						if (status === 302) {
							const h: OutgoingHttpHeaders | { Location: string } = (headers as OutgoingHttpHeaders) || (typeof message === 'object' && message);
							log(`Redirecting client to ${highlight(h && h.Location as string || 'nowhere!')}`);
						}
						return origWriteHead(status, message, headers);
					} as any;

					let end = false;
					const origEnd = res.end.bind(res);
					res.end = function (data: Uint8Array | string, encoding: BufferEncoding, callback?: () => void) {
						end = true;
						return origEnd(data, encoding, callback);
					} as any;

					let result;
					if (typeof request.handler === 'function') {
						result = await request.handler(req, res, url);
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
					request.resolve({ result, url });
				} catch (err: any) {
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
						if (id) {
							this.pending.delete(id);
						}
						request.reject(err);
					}
				}
			}) as CallbackServer;

			this.server.destroy = async function destroy() {
				const conns = Object.values(connections);
				log(`Destroying ${conns.length} connection${conns.length === 1 ? '' : 's'}`);
				for (const conn of conns) {
					conn.destroy();
				}
				log('Closing HTTP server...');
				await new Promise<void>(resolve => this.close(() => resolve()));
				log('HTTP server closed');
			};

			this.server
				.on('connection', function (conn: Socket) {
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
	async stop(force?: boolean) {
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
