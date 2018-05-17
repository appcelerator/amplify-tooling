import fs from 'fs-extra';

import { configFile } from './locations';

export function read() {
	console.log(configFile);
	if (!fs.existsSync(configFile)) {
		write({});
	}
	return fs.readJsonSync(configFile);
}

export function write(contents) {
	fs.outputJsonSync(configFile, contents, { spaces: '\t' });
}
