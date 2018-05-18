import gittar from '@awam/gittar';

export async function fetchFromGit({ pkgInfo }) {
	return await gittar.fetch(pkgInfo.dist.download_url);
}

export async function fetchPackage({ pkgInfo }) {
	switch (pkgInfo.dist.download_type) {
		case 'git':
			return await fetchFromGit({ pkgInfo });
	}
}

export default fetchPackage;
