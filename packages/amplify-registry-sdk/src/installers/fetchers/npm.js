import pacote from 'pacote';

import { cacheDir } from '../../common';
import { join } from 'path';

const npmCacheDir =  join(cacheDir, 'npm');

export async function fetchPackage({ pkgInfo }) {
	let { name, version } = pkgInfo;
	const opts = {};
	if (pkgInfo.dist.registry_url) {
		opts.registry = pkgInfo.dist.registry_url;
	}
	if (!version) {
		version = 'latest';
	}
	const pkg = await pacote.manifest(`${name}@${version}`, opts);
	if (version === 'latest') {
		version = pkg.version;
	}
	const tgzLocation = join(npmCacheDir, name, version, 'package.tgz');
	await pacote.tarball.toFile(`${name}@${version}`, tgzLocation, opts);
	return tgzLocation;
}
