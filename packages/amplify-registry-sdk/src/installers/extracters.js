import { moveSync, readJSONSync, readdirSync } from 'fs-extra';
import tmp from 'tmp';

import { extractTar, packagesDir } from './common';
import { join } from 'path';

export default async function extractPackage({ zipLocation, type }) {

	let pkgLocation;
	const tempDir = tmp.tmpNameSync({ prefix: 'amplify-pm-install-' });

	await extractTar({ file: zipLocation, dest: tempDir });

	const { name, version } = readJSONSync(join(tempDir, 'package.json'));

	switch (type) {
		case 'apib-data-connector':
			pkgLocation = join(process.cwd(), 'connectors', name);
			break;
		case 'amplify-cli-plugin':
			pkgLocation = join(packagesDir, name, version);
			break;
		default:
			throw new Error('Unsupported package type');
	}

	moveSync(tempDir, pkgLocation, { overwrite: true });

	return pkgLocation;
}
