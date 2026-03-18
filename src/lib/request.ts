import _, { flatten } from 'lodash';
import fs from 'fs';
import chalk from 'chalk';
import got, { RequestError, TimeoutError } from 'got';
import httpProxyAgentPkg from 'http-proxy-agent';
import httpsProxyAgentPkg from 'https-proxy-agent';
import promiseLimit from 'promise-limit';
import loadConfig, { Config } from './config.js';
import path from 'path';
import prettyBytes from 'pretty-bytes';
import logger, { alert, highlight, ok, note } from './logger.js';
import { fileURLToPath } from 'url';
import { readJsonSync } from './fs.js';
import { ABORT_TIMEOUT, ProgressListener } from './types.js';

const { HttpProxyAgent } = httpProxyAgentPkg;
const { HttpsProxyAgent } = httpsProxyAgentPkg;

const { log } = logger('axway-cli:request');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { version } = readJsonSync(path.resolve(__dirname, '../../package.json'));
/**
 * The user agent to use in outgoing requests.
 * IMPORTANT! Platform explicitly checks this user agent, so do NOT change the name or case.
 */
const userAgent = `Axway CLI/${version} (${process.platform}; ${process.arch}; node:${process.versions.node})`;

export { got };

/**
 * Creates an options object for use with `got`.
 *
 * @param {Object} [opts] - `got` options.
 * @param {Buffer|String} [opts.ca] - A buffer containing the certificate authority bundle or a
 * path to a PEM-formatted ca bundle.
 * @param {Buffer|String} [opts.cert] - A buffer containing a client certificate or a path to a
 * cert file. This value is used for HTTP authentication.
 * @param {Object} [opts.defaults] - An object with the default options. This is helpful when you
 * want to merge settings from some config file with various got() options such as `headers`.
 * @param {Buffer|String} [opts.key] - A buffer containing a client private key or a path to a
 * private key file. This value is used for HTTP authentication.
 * @param {String} [opts.proxy] - A proxy server URL. Can be `http` or `https`.
 * @param {Boolean} [opts.strictSSL=true] - When falsey, disables TLS/SSL certificate validation
 * for both `https` destinations and `https` proxy servers.
 * @returns {Promise} Resolves `got` options object.
 */
export function options(opts: any = {}) {
	if (!opts || typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	}

	opts = { ...opts };

	const { defaults } = opts;
	const {
		ca = defaults?.ca,
		caFile = defaults?.caFile,
		cert = defaults?.cert,
		certFile = defaults?.certFile,
		key = defaults?.key,
		keyFile = defaults?.keyFile,
		proxy = defaults?.proxy,
		strictSSL = defaults?.strictSSL,
	} = opts;

	delete opts.ca;
	delete opts.caFile;
	delete opts.cert;
	delete opts.certFile;
	delete opts.defaults;
	delete opts.key;
	delete opts.keyFile;
	delete opts.proxy;
	delete opts.strictSSL;

	// Default all requests to use the custom CLI user agent
	opts.headers = {
		'User-Agent': userAgent,
	};

	const load = (it) =>
		(Buffer.isBuffer(it)
			? it
			: typeof it === 'string'
				? fs.readFileSync(it)
				: undefined);

	opts.hooks = _.merge(opts.hooks, {
		afterResponse: [
			(response) => {
				const { headers, request, statusCode, url } = response;
				log(
					[
						request.options.method,
						highlight(url),
						proxy && note(`[proxy ${proxy}]`),
						Object.prototype.hasOwnProperty.call(headers, 'content-length')
              && chalk.magenta(
              	`(${prettyBytes(Number(headers['content-length']))})`
              ),
						statusCode < 400 ? ok(statusCode) : alert(statusCode),
					]
						.filter(Boolean)
						.join(' ')
				);
				return response; // note: this must return response
			},
		],
	});

	opts.https = {
		...(opts.https || {}),
		certificate: load(opts.https?.certificate || cert || certFile),
		certificateAuthority: load(
			opts.https?.certificateAuthority || ca || caFile
		),
		key: load(opts.https?.key || key || keyFile),
		rejectUnauthorized:
      opts.https?.rejectUnauthorized !== undefined
      	? opts.https.rejectUnauthorized
      	: !!strictSSL !== false,
	};

	if (proxy) {
		const agentOpts = {
			ca: opts.https.certificateAuthority,
			cert: opts.https.certificate,
			key: opts.https.key,
			rejectUnauthorized: opts.https.rejectUnauthorized,
		};
		opts.agent ||= {};
		// @ts-expect-error - For some reason the typings for HttpProxyAgent is reporting the agentOpts arg as `never`.
		opts.agent.http ||= new HttpProxyAgent(proxy, agentOpts);
		// @ts-expect-error - For some reason the typings for HttpsProxyAgent is reporting the agentOpts arg as `never`.
		opts.agent.https ||= new HttpsProxyAgent(proxy, agentOpts);
	}

	return opts;
}

/**
 * Creates `got` instance with the applied configuration.
 *
 * @param {Object} [opts] - `got` options.
 * @param {Buffer|String} [opts.ca] - A buffer containing the certificate authority bundle or a
 * path to a PEM-formatted ca bundle.
 * @param {Buffer|String} [opts.cert] - A buffer containing a client certificate or a path to a
 * cert file. This value is used for HTTP authentication.
 * @param {Object} [opts.defaults] - An object with the request defaults.
 * @param {Buffer|String} [opts.key] - A buffer containing a client private key or a path to a
 * private key file. This value is used for HTTP authentication.
 * @param {String} [opts.proxy] - A proxy server URL. Can be `http` or `https`.
 * @param {Boolean} [opts.strictSSL=true] - When falsey, disables TLS/SSL certificate validation
 * for both `https` destinations and `https` proxy servers.
 * @returns {Function} A `got` instance.
 */
export function init(opts = {}) {
	return got.extend(options(opts));
}

export default init;

/**
 * Loads the Axway CLI config file and construct the options for the various Node.js HTTP clients
 * including `pacote`, `npm-registry-fetch`, `make-fetch-happen`, and `request`.
 *
 * @param {Object} [opts] - Request configuration options to override the Axway CLI config
 * settings.
 * @param {Config} [config] - An Amplify Config instance. If not specified, the config is loaded
 * from disk.
 * @returns {Object}
 */
export function createRequestOptions(opts = {}, config?): any {
	if (opts instanceof Config) {
		config = opts;
		opts = {};
	} else if (!opts && typeof opts !== 'object') {
		throw new TypeError('Expected options to be an object');
	} else {
		opts = { ...opts };
	}

	if (config && !(config instanceof Config)) {
		throw new TypeError('Expected config to be an Amplify Config instance');
	}

	const load = async (src, dest) => {
		if (opts[dest] !== undefined) {
			return;
		}
		if (!config) {
			config = await loadConfig();
		}
		const value = await config.get(src);
		if (value === undefined) {
			return;
		}
		if (dest === 'proxy') {
			opts[dest] = value;
		} else if (dest === 'strictSSL') {
			opts[dest] = !!value !== false;
		} else {
			opts[dest] = fs.readFileSync(value);
		}
	};

	load('network.caFile', 'ca');
	load('network.certFile', 'cert');
	load('network.keyFile', 'key');
	load('network.proxy', 'proxy');
	load('network.httpsProxy', 'proxy');
	load('network.httpProxy', 'proxy');
	load('network.strictSSL', 'strictSSL');

	return opts;
}

// ____ ENGAGE _______

type DataServiceMethods = {
	post: (
		url: string,
		body: object,
		headers?: object,
		params?: object
	) => Promise<any>;
	put: (
		route: string,
		body: object,
		headers?: object,
		params?: object
	) => Promise<any>;
	get: (url: string, params?: object) => Promise<any>;
	head: (url: string, params?: object) => Promise<any>;
	getWithPagination: (
		url: string,
		params?: object,
		pageSize?: number,
		progressListener?: ProgressListener
	) => Promise<any>;
	delete: (url: string, params?: object) => Promise<any>;
	download: (url: string) => Promise<any>;
};

const handleResponse = (response: any) => {
	return /application\/json/.test(response.headers['content-type'])
		? JSON.parse(response.body)
		: response.body;
};

const updateRequestError = (err: Error) => {
	// Do not change given object if it's a timeout error.
	if (err instanceof TimeoutError) {
		return;
	}

	// If we have a JSON HTTP body, then turn it into a dictionary.
	let jsonBody = null;
	if (err instanceof RequestError && err.response?.body) {
		jsonBody = handleResponse(err.response);
	}
	if (!jsonBody) {
		return;
	}

	// Turn given Error object into an "ApiServerError" or "ApiServerErrorResponse" object.
	if (
		typeof jsonBody.code === 'number'
    && typeof jsonBody.description === 'string'
	) {
		// We received a "Platform" server error response.
		(err as any).status = jsonBody.code;
		(err as any).detail = jsonBody.description;
	} else {
		// Assume we received a "Central" server error response which should already conform to "ApiServerError".
		Object.assign(err, jsonBody);
	}
};

/**
 * Creates an object with various functions communicating with the API Server.
 * @param {String} clientId Client id to use.
 * @param {String} [team] The preferred team to use. This value overrides the default from the Axway CLI config.
 * @param {String} [region] The preferred region to use.
 * @returns Object containing data retrieval functions.
 */
export const dataService = async ({
	account,
}: {
	account?: any;
}): Promise<DataServiceMethods> => {
	const token = account.auth?.tokens?.access_token;
	if (!token) {
		throw new Error('Invalid/expired account');
	}
	const headers: any = {
		Accept: 'application/json',
		Authorization: `Bearer ${token}`,
		'X-Axway-Tenant-Id': account.org.org_id,
	};
	const got = init(createRequestOptions({ headers }));
	const fetch = async (
		method: string,
		url: string,
		params = {}
	): Promise<any> => {
		try {
			// add the team guid - TODO: add this team validtion part of the command.
			//   if (teamGuid !== undefined) {
			//     const parsed = new URL(url);
			//     parsed.searchParams.set(
			//       "query",
			//       teamGuid
			//         ? `owner.id==${teamGuid},(owner.id==null;metadata.scope.owner.id==${teamGuid})`
			//         : "owner.id==null"
			//     );
			//     url = parsed.toString();
			//   }

			const response = await got[method](url, {
				followRedirect: false,
				retry: 0,
				timeout: ABORT_TIMEOUT,
				...params,
			});

			return response;
		} catch (err: any) {
			updateRequestError(err);
			throw err;
		}
	};

	return {
		post: (url: string, data: object, headers = {}) => {
			log(`POST: ${url}`);
			log(data);
			return fetch('post', url, {
				headers: headers,
				json: data,
			}).then(handleResponse);
		},
		put: (url: string, data: object, headers = {}) => {
			log(`PUT: ${url}`);
			return fetch('put', url, {
				headers: headers,
				json: data,
			}).then(handleResponse);
		},
		get: (url: string, params = {}) => {
			log(`GET: ${url}`);
			return fetch('get', url, params).then(handleResponse);
		},
		head: (url: string, params?: object) => {
			log(`HEAD: ${url}`);
			return fetch('head', url, params).then((response) => {
				return response.headers['x-axway-total-count'];
			});
		},
		/**
     * Get the entire list using pagination. Method is trying to define total number of items based on response header
     * and makes additional calls if needed to retrieve additional pages.
     * Note: currently this only present correct results if response is an array (see the "allPages" var spread logic)
     * @param route route to hit
     * @param queryParams specific query params
     * @param pageSize page size to use, by default = 50
     * @param headers headers to add
     * @param progressListener invoked multiple times where argument is assigned progress value 0-100
     */
		getWithPagination: async function (
			url: string,
			params: any = {},
			pageSize: number = 50,
			progressListener?: ProgressListener
		) {
			params.searchParams.pageSize = pageSize;
			log(`GET (with auto-pagination): ${url}`);
			const response = await fetch('get', url, params);
			const totalCountHeader = response.headers['x-axway-total-count'];
			if (totalCountHeader === null || totalCountHeader === undefined) {
				log(
					'GET (with auto-pagination), warning: cannot figure out \'total count\' header, resolving response as-is'
				);
				return handleResponse(response);
			}

			log(
				`GET (with auto-pagination), 'total count' header found, count = ${totalCountHeader}, will fire additional GET calls if needed`
			);
			const totalPages = Math.max(
				Math.ceil(Number(totalCountHeader) / pageSize),
				1
			);
			const allPages = new Array(totalPages);
			allPages[0] = handleResponse(response);
			if (totalPages > 1) {
				const limit = promiseLimit(8); // Limits number of concurrrent HTTP requests.
				const otherPagesCalls = [];
				let pageDownloadCount = 1;
				const updateProgress = () => {
					if (progressListener && totalPages > 4) {
						progressListener(
							Math.floor((pageDownloadCount / totalPages) * 100)
						);
					}
				};
				updateProgress();
				for (let pageIndex = 1; pageIndex < totalPages; pageIndex++) {
					const thisPageIndex = pageIndex;
					params.searchParams.page = `${thisPageIndex + 1}`;

					otherPagesCalls.push(
						// eslint-disable-next-line no-loop-func
						limit(async () => {
							allPages[thisPageIndex] = await (this as DataServiceMethods).get(
								url,
								params
							);
							pageDownloadCount++;
							updateProgress();
						})
					);
				}
				await Promise.all(otherPagesCalls);
			}
			return flatten(allPages);
		},
		delete: (url: string, params = {}) => {
			log(`DELETE: ${url}`);
			return fetch('delete', url, params).then(handleResponse);
		},
		download: async (url: string) => {
			try {
				return await new Promise((resolve, reject) => {
					log(`DOWNLOAD: ${url}`);
					const stream = got.stream(url, {
						retry: { limit: 0 },
						timeout: { request: ABORT_TIMEOUT },
					});
					stream.on('response', (response: any) => {
						if (response.statusCode < 300) {
							resolve({ response, stream });
						} else {
							reject(new Error());
						}
					});
					stream.on('error', reject);
				});
			} catch (err: any) {
				updateRequestError(err);
				throw err;
			}
		},
	};
};
