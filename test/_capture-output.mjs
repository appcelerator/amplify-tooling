// Temporary script to capture raw CLI output format
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'axway-fmt-test-'));
const homeLocal = path.resolve(root, 'test/helpers/home-local');
fs.cpSync(homeLocal, path.join(tmpHome, '.axway', 'axway-cli'), { recursive: true });

const env = {
	...process.env,
	HOME: tmpHome,
	AXWAY_CENTRAL_BASE_URL: 'http://127.0.0.1:8777',
	FORCE_COLOR: '1',
	AXWAY_TEST: '1',
};

const axwayBin = path.resolve(root, 'dist/index.js');

async function run(args) {
	return new Promise((resolve) => {
		const p = spawn(process.execPath, [axwayBin, ...args], { env });
		let stdout = '';
		let stderr = '';
		p.stdout.on('data', d => stdout += d.toString());
		p.stderr.on('data', d => stderr += d.toString());
		p.on('close', (status) => resolve({ status, stdout, stderr }));
	});
}

// Login
const login = await run(['auth', 'login', '--client-id', 'test_client', '--client-secret', 'secret', '--no-banner']);
console.log('Login status:', login.status);

// Apply (no --output, uses spinner → stderr)
const result = await run(['engage', 'apply', '--file', path.resolve(root, 'test/resources/testData/testInstances1short.yaml'), '--no-banner']);
console.log('=== STDERR (raw JSON) ===');
console.log(JSON.stringify(result.stderr));
console.log('=== STDERR (visible) ===');
process.stdout.write(result.stderr);

fs.rmSync(tmpHome, { recursive: true });
