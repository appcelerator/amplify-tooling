/**
 * Shared helpers for engage command tests.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { initHomeDir, loginCLI, resetHomeDir } from './index.js';
import { e400, e500 } from '../resources/testData/errors.js';

export { initHomeDir, resetHomeDir };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to the shared testData directory. */
export const testDataDir = path.resolve(__dirname, '../resources/testData');

/**
 * Env vars that point the CLI at the local mock engage server.
 * Pass as `{ env: engageEnv }` in runCommand options.
 */
export const engageEnv = {
	AXWAY_CENTRAL_BASE_URL: 'http://127.0.0.1:8777',
};

/** 400 Validation error response body – matches the shape returned by the real API Server. */
export { e400, e500 };

/**
 * Standard beforeEach for authenticated engage tests.
 * Sets up home-local, logs in, resets engage server state, and returns the engage server.
 *
 * Call with `setupEngageAuth.call(this)` inside Mocha's beforeEach so `this.servers` is accessible.
 *
 * @example
 *   let engageServer;
 *   beforeEach(async function () { engageServer = await setupEngageAuth.call(this); });
 *   afterEach(resetHomeDir);
 *
 * @this {Mocha.Context}
 * @returns {Promise<object>} The engage server instance (this.servers[2]).
 */
export async function setupEngageAuth() {
	initHomeDir('home-local');
	await loginCLI();
	const engageServer = this.servers?.[2];
	engageServer?.resetEngageState();
	return engageServer;
}
