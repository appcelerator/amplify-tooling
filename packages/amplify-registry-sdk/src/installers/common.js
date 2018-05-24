import tar from 'tar';

import fs from 'fs-extra';
import { run } from 'appcd-subprocess';

export async function npmInstall({ directory }) {
	const { err } = await run('npm', [ 'install', '--production' ], { cwd: directory, shell: true, windowsHide: true });
	if (err) {
		throw err;
	}
}

export function writeLastUsed(directory) {
	// Write something that lets us know when the package was last used
}

export function extractTar({ file, dest, opts }) {
	return new Promise((resolve, reject) => {
		opts = Object.assign({ strip: 1 }, opts, { file, cwd: dest });
		fs.ensureDirSync(dest);
		tar.extract(opts).then(() => resolve(dest)).catch(reject);
	});
}
