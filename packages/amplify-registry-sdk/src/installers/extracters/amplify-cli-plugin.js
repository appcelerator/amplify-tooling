import fs from 'fs-extra';
import tmp from 'tmp';

import { extractTar } from '../common';
import { packagesDir } from '../../common';
import { join } from 'path';

export async function extractPackage(zipLocation) {
	const tempDir = tmp.tmpNameSync({ prefix: 'amplify-pm-install-' });
	await extractTar({ file: zipLocation, dest: tempDir });
	const pkg = fs.readJSONSync(join(tempDir, 'package.json'));
	const pkgLocation = join(packagesDir, pkg.name, pkg.version);
	fs.copySync(tempDir, pkgLocation);
	return pkgLocation;
}

export default extractPackage;
