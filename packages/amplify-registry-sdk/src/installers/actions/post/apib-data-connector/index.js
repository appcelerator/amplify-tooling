import fs from 'fs-extra';
import path from 'path';

import { npmInstall } from '../../common';

export async function run({ pkgInfo, location }) {
	await Promise.all([
		npmInstall({ directory: location }),
		copyConfig({ pkgInfo, location })
	])
		.then()
		.catch();
}

export async function copyConfig({ pkgInfo, location }) {
	const confDir = path.join(process.cwd(), 'conf');
	const name = pkgInfo.name;
	const confFiles = fs.readdirSync(confDir).filter(filename => filename.includes(name));
	const exampleConf = path.join(location, 'conf', 'example.config.js');
	if (confFiles.length || !fs.existsSync(exampleConf)) {
		return;
	}
	const filename = path.join(confDir, `${name}.default.js`);
	fs.copyFile(exampleConf, filename);
	console.log(`Copied across default config for ${pkgInfo.name} to ${path.relative(process.cwd(), filename)}. You must update the config before you can use it!`);
}
