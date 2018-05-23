import fs from 'fs-extra';
import tmp from 'tmp';

import { extractTar } from './common';
import { packagesDir } from '../common';
import { join } from 'path';

export default async function extractPackage({ zipLocation, type }) {
	let pkgLocation;
	const tempDir = tmp.tmpNameSync({ prefix: 'amplify-pm-install-' });
	switch (type) {
		case 'apib-data-connector':
			const tempLocation = await extractTar({ file: zipLocation, dest: tempDir });
			const projectName = fs.readJSONSync(join(tempLocation, 'package.json')).name;
			pkgLocation = join(process.cwd(), 'connectors', projectName);
			fs.copySync(tempLocation, pkgLocation);
			break;
		case 'amplify-cli-plugin':
			await extractTar({ file: zipLocation, dest: tempDir });
			const pkg = fs.readJSONSync(join(tempDir, 'package.json'));
			pkgLocation = join(packagesDir, pkg.name, pkg.version);
			fs.copySync(tempDir, pkgLocation);
			break;
		default:
			throw new Error('Unsupported package type');
	}
	return pkgLocation;
}
