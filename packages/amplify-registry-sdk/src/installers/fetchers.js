import gittar from '@awam/gittar';
import pacote from 'pacote';

import { cacheDir } from './common';
import { existsSync } from 'fs';
import { join } from 'path';
import { buildProxyParams } from '@axway/amplify-request';

const npmCacheDir =  join(cacheDir, 'npm');

export default async function fetchPackage(pkgInfo) {
	let downloadLocation;
	switch (pkgInfo.dist.download_type) {
		case 'npm':
			let { name, version } = pkgInfo;
			const opts = {};

			if (pkgInfo.dist.registry_url) {
				opts.registry = pkgInfo.dist.registry_url;
			}

			if (!version) {
				version = 'latest';
			}

			Object.assign(opts, buildProxyParams());

			const pkg = await pacote.manifest(`${name}@${version}`, opts);

			if (version === 'latest') {
				version = pkg.version;
			}

			downloadLocation = join(npmCacheDir, name, version, 'package.tgz');

			if (!existsSync(downloadLocation)) {
				await pacote.tarball.toFile(`${name}@${version}`, downloadLocation, opts);
			}
			break;
		case 'git':
			downloadLocation = await gittar.fetch(pkgInfo.dist.download_url);
			break;
		default:
			throw new Error('Unsupported package type');
	}
	return downloadLocation;
}
