import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

import { extractTar } from '../common';

export async function extractPackage(zipLocation) {
	const tempDir = tmp.tmpNameSync({ prefix: 'amplify-pm-install-' });
	const tempLocation = await extractTar({ file: zipLocation, dest: tempDir });
	const projectName = fs.readJSONSync(path.join(tempLocation, 'package.json')).name;
	const location = path.join(process.cwd(), 'connectors', projectName);
	fs.copySync(tempLocation, location);
	return location;
}

export default extractPackage;
