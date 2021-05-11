'use strict';

const ansiColors   = require('ansi-colors');
const chug         = require('gulp-chug');
const debug        = require('gulp-debug');
const fs           = require('fs-extra');
const gulp         = require('gulp');
const log          = require('fancy-log');
const path         = require('path');
const plumber      = require('gulp-plumber');
const semver       = require('semver');
const spawnSync    = require('child_process').spawnSync;
const tmp          = require('tmp');

const { series } = gulp;
const { red, yellow, green, cyan, magenta, gray } = ansiColors;

const nodeInfo = exports['node-info'] = async function nodeInfo() {
	log(`Node.js ${process.version} (${process.platform})`);
	log(process.env);
};

// checks to see if a package requires a node version that is less than a dependencies node requirement
exports['check-engines'] = async function checkEngines() {
	const cache = {};
	const issues = [];

	const checkPackage = (pkgPath, depth = 0) => {
		const pkgJsonPath = path.join(pkgPath, 'package.json');
		if (!fs.existsSync(pkgJsonPath)) {
			return false;
		}

		if (cache[pkgPath]) {
			return cache[pkgPath];
		}

		const pkgJson = require(pkgJsonPath);
		const info = pkgJson.engines && pkgJson.engines.node && semver.coerce(pkgJson.engines.node);
		const node = cache[pkgPath] = info ? info.version : null;

		// console.log(`${'  '.repeat(depth)}${green(pkgJson.name)}${node ? ` (${node})` : ''}`);

		if (pkgJson.dependencies) {
			for (const dep of Object.keys(pkgJson.dependencies)) {
				for (let wd = pkgPath; true; wd = path.dirname(wd)) {
					const depNode = checkPackage(path.join(wd, 'node_modules', dep), depth + 1);
					if (!cache[pkgPath] || (depNode && semver.gt(depNode, cache[pkgPath]))) {
						cache[pkgPath] = depNode;
					}
					if (/^@axway/.test(pkgJson.name) && node && depNode && semver.lt(node, depNode)) {
						issues.push({
							name: pkgJson.name,
							node,
							dep,
							depNode
						});
						break;
					}
					if (depNode !== false) {
						// depNode is null (no node version) or a string
						break;
					}
					if (wd === __dirname) {
						throw new Error(`Unable to find dependency "${dep}"`);
					}
				}
			}
		}

		return cache[pkgPath];
	};

	const nodeVer = checkPackage(`${__dirname}/packages/axway-cli`);
	console.log(`\nMinimum Node version should be ${cyan(nodeVer)}\n`);

	if (issues.length) {
		console.log(`Found ${issues.length} issue${issues.length === 1 ? '' : 's'}`);
		console.log(issues.map(({ name, node, dep, depNode }) => `  ${green(name)} requires ${node}\n    ${cyan(dep)} requires ${depNode}`).join('\n') + '\n');
	}
};

/*
 * lint tasks
 */
exports.lint = function lint() {
	return gulp
		.src([
			path.join(__dirname, 'packages/*/gulpfile.js')
		])
		.pipe(debug({ title: 'Linting project:' }))
		.pipe(plumber())
		.pipe(chug({ tasks: [ 'lint' ] }));
};

/*
 * build tasks
 */
const build = exports.build = async function build() {
	return runLernaBuild();
};

/*
 * test tasks
 */
let origHomeDir = process.env.HOME;
let tmpHomeDir = null;

async function runTests(cover, all) {
	try {
		await fs.remove(path.join(__dirname, '.nyc_output'));
		await fs.remove(path.join(__dirname, 'coverage'));

		process.env.APPCD_TEST_GLOBAL_PACKAGE_DIR = path.join(__dirname, 'packages');
		process.env.SPAWN_WRAP_SHIM_ROOT = origHomeDir;
		process.env.NODE_ENV = 'test'; // disables the update check
		// process.env.SNOOPLOGG = '*';

		tmpHomeDir = tmp.dirSync({
			mode: '755',
			prefix: 'axway-cli-test-home-',
			unsafeCleanup: true
		}).name;

		log(`Protecting home directory, overriding HOME with temp dir: ${cyan(tmpHomeDir)}`);
		process.env.HOME = process.env.USERPROFILE = tmpHomeDir;
		if (process.platform === 'win32') {
			process.env.HOMEDRIVE = path.parse(tmpHomeDir).root.replace(/[\\/]/g, '');
			process.env.HOMEPATH = tmpHomeDir.replace(process.env.HOMEDRIVE, '');
		}

		const runner = require('appcd-gulp/src/test-runner');
		await runner.runTests({
			all,
			cover,
			projectDir: __dirname,
			root: __dirname,
			slow: 15000,
			timeout: 20000
		});
	} catch (err) {
		//
	} finally {
		// restore home directory so that we can delete the temp one
		if (tmpHomeDir) {
			log(`Removing temp home directory: ${cyan(tmpHomeDir)}`);
			fs.removeSync(tmpHomeDir);
		}

		log(`Restoring home directory: ${cyan(origHomeDir)}`);
		process.env.HOME = origHomeDir;
	}
}

exports.integration = series(nodeInfo, /* build, */ function test()     { return runTests(true); });
exports.test        = series(nodeInfo, /* build, */ function coverage() { return runTests(true, true); });

/*
 * watch task
 */
exports.watch = series(build, async function watch() {
	const srcWatcher = gulp
		.watch(`${__dirname}/packages/*/src/**/*.js`)
		.on('all', (type, path) => {
			// FIXME: There's almost certainly a better way of doing this than replacing \\ with /
			path = path.replace(/\\/g, '/');
			const m = path.match(new RegExp(`^(${__dirname.replace(/\\/g, '/')}/(packages/([^\/]+)))`));
			if (m) {
				log(`Detected change: ${cyan(path)}`);
				const pkgJson = path.join(m[1], 'package.json');

				try {
					runLernaBuild(JSON.parse(fs.readFileSync(pkgJson)).name);
				} catch (e) {
					log(`Failed to read/parse ${pkgJson}: ${e.toString()}`);
				}
			}
		});

	let stopping = false;

	return new Promise(resolve => {
		process.on('SIGINT', () => {
			if (!stopping) {
				stopping = true;
				srcWatcher.close();
				resolve();
			}
		});
	});
});

async function runLernaBuild(scope) {
	let { execPath } = process;
	const args = [ './node_modules/.bin/lerna', 'run', 'build', '--parallel' ];

	if (process.platform === 'win32') {
		args.shift();
		execPath = path.join(__dirname, 'node_modules', '.bin', 'lerna.cmd');
	}

	if (scope) {
		args.push('--scope', scope);
	}

	log(`Running ${execPath} ${args.join(' ')}`);
	const { status } = spawnSync(execPath, args, { stdio: 'inherit' });
	if (status) {
		throw new Error(`lerna build failed ${scope ? `for ${scope}` : ''}`);
	}
}

exports['release-notes'] = async function releaseNotes() {
	const { cyan } = require('ansi-colors');
	const https    = require('https');
	const semver   = require('semver');
	const tar      = require('tar-stream');
	const zlib     = require('zlib');

	const packages = {};
	const re = /^@axway\//;
	const tempDir = tmp.dirSync({
		mode: '755',
		prefix: 'axway-cli-release-notes-',
		unsafeCleanup: true
	}).name;
	const cacheDir = path.join(__dirname, '.npm-info');

	await fs.mkdirs(cacheDir);

	const fetch = async name => {
		const cacheFile = path.join(cacheDir, `${name}.json`);
		await fs.mkdirs(path.dirname(cacheFile));
		let info;

		if (fs.existsSync(cacheFile)) {
			log(`Fetching ${cyan(name)} from cache`);
			const s = fs.readFileSync(cacheFile, 'utf8');
			info = s ? JSON.parse(s) : null;
		} else {
			log(`Fetching ${cyan(name)}`);
			const { status, stdout, stderr } = spawnSync('npm', [ 'view', name, '--json' ]);
			if (status) {
				console.error('Failed to get package info:');
				console.error(stdout.toString());
				console.error(stderr.toString());
				process.exit(1);
			}
			const s = stdout.toString();
			fs.writeFileSync(cacheFile, s);

			info = s ? JSON.parse(s) : null;
		}

		// if more than one is returned, get the latest
		if (Array.isArray(info)) {
			let pkg;
			for (const i of info) {
				if (!pkg || semver.gt(i.version, pkg.version)) {
					pkg = i;
				}
			}
			info = pkg;
		}

		return info;
	};

	const getPackageInfo = async (name, ver) => {
		const info = await fetch(`${name}@${ver}`);
		if (!info || packages[name]) {
			return info;
		}

		ver = info.version;

		log(`Initializing new package ${name}`);
		packages[name] = { latest: null, versions: {} };

		log(`  Versions: ${info.versions.join(', ')}`);
		for (const version of info.versions) {
			if (!packages[name].versions[version] && semver.valid(version) && semver.gt(version, '0.0.0')) {
				const { prerelease } = semver.parse(version);
				if (!prerelease || !prerelease.length) {
					log(`  Initializing pacakge ${name}@${version}`);
					const verInfo = await fetch(`${name}@${version}`);
					if (verInfo) {
						packages[name].versions[version] = { changelog: null, ts: info.time[version], version };
						for (const type of [ 'dependencies', 'devDependencies' ]) {
							if (verInfo[type]) {
								for (const [ dep, range ] of Object.entries(verInfo[type])) {
									if (re.test(dep)) {
										await getPackageInfo(dep, range);
									}
								}
							}
						}
					}
				}
			}
		}

		return info;
	};

	const processChangelog = (name, changelog) => {
		const changes = changelog.split('\n\n#').map((s, i) => `${i ? '#' : ''}${s}`.trim());
		for (const chunk of changes) {
			const m = chunk.match(/^# v?([^\s\n]*)[^\n]*\n+(.+)$/s);
			if (!m) {
				continue;
			}

			const { version } = semver.coerce(m[1]);

			if (packages[name].versions[m[1]]) {
				packages[name].versions[m[1]].changelog = m[2];
			} else if (packages[name].versions[version]) {
				packages[name].versions[version].changelog = m[2];
			} else {
				log(red(`Package ${name} does not have a version ${m[1]}! (${Object.keys(packages[name].versions).join(', ')})`));
			}
		}
	};

	try {
		// Step 1: get all the `axway` releases and their `@axway/*` dependencies
		const { versions } = await fetch('axway');
		for (const ver of versions) {
			if (semver.valid(ver) && semver.gt(ver, '0.0.0')) {
				const { prerelease } = semver.parse(ver);
				if (!prerelease || !prerelease.length) {
					await getPackageInfo('axway', ver);
				}
			}
		}

		// Step 2: add in the local packages
		const local = {};
		for (const subdir of fs.readdirSync(path.join(__dirname, 'packages'))) {
			try {
				const pkgJson = fs.readJsonSync(path.join(__dirname, 'packages', subdir, 'package.json'));
				let { name, version } = pkgJson;
				local[name] = pkgJson;
				const changelogFile = path.join(__dirname, 'packages', subdir, 'CHANGELOG.md');
				const changelog = fs.existsSync(changelogFile) ? fs.readFileSync(changelogFile, 'utf8') : null;
				let ts = null;

				const m = changelog && changelog.match(/^# v([^\s]+)/);
				if (m && m[1] !== version) {
					// set release timestamp to now unless package is axway, then make it 10 seconds older
					ts = new Date(Date.now() + (name === 'axway' || name === '@axway/amplify-cli' ? 10000 : 0));
					pkgJson.version = version = m[1];
				}

				// TEMP: another v2 prerelease hack
				version = semver.coerce(version).version;
				if (name === '@axway/amplify-cli') {
					name = 'axway';
				}

				if (!packages[name]) {
					packages[name] = { latest: null, versions: {} };
				}

				if (!packages[name] || !packages[name].versions[version]) {
					packages[name].local = true;
					packages[name].versions[version] = { changelog: null, local: true, ts, version };
				}

				if (changelog) {
					processChangelog(name, changelog);
				}
			} catch (e) {}
		}

		// Step 3: for each non-local package, fetch the latest npm package and extract the changelog
		for (const [ pkg, info ] of Object.entries(packages)) {
			if (!packages[pkg].latest) {
				packages[pkg].latest = Object.keys(info.versions).sort(semver.compare).pop();
			}

			if (info.local) {
				continue;
			}

			const changelogFile = path.join(cacheDir, `${pkg}@${info.latest}_CHANGELOG.md`);
			if (fs.existsSync(changelogFile)) {
				processChangelog(pkg, fs.readFileSync(changelogFile, 'utf8'));
			} else {
				const url = `https://registry.npmjs.org/${pkg}/-/${path.basename(pkg)}-${info.latest}.tgz`;
				const file = path.join(tempDir, `${path.basename(pkg)}-${info.latest}.tgz`);

				await new Promise((resolve, reject) => {
					const dest = fs.createWriteStream(file);
					dest.on('finish', () => dest.close(resolve));
					log(`Downloading ${cyan(url)}`);
					https.get(url, response => response.pipe(dest))
						.on('error', reject);
				});

				await new Promise((resolve, reject) => {
					const gunzip = zlib.createGunzip();
					const extract = tar.extract();

					extract.on('entry', (header, stream, next) => {
						if (header.name !== 'package/CHANGELOG.md') {
							stream.resume();
							return next();
						}

						let changelog = '';
						stream
							.on('data', chunk => changelog += chunk)
							.on('end', () => {
								fs.writeFileSync(changelogFile, changelog, 'utf8');
								processChangelog(pkg, changelog);
								next();
							})
							.on('error', reject)
							.resume();
					});

					extract.on('finish', resolve);
					extract.on('error', reject);

					log(`Extract changelog from ${cyan(file)}`);
					fs.createReadStream(file).pipe(gunzip).pipe(extract);
				});
			}
		}
	} finally {
		fs.removeSync(tempDir);
	}

	const axwayCli = packages['axway'];
	delete packages['axway'];
	const pkgs = Object.keys(packages).sort();

	// Step 4: loop over every `axway` release and generate the changelog
	for (const ver of Object.keys(axwayCli.versions).sort(semver.compare)) {
		const { raw } = semver.coerce(ver);
		if (semver.lte(raw, '2.0.0')) {
			continue;
		}
		const { major, minor, patch } = semver.parse(ver);
		const cleanVersion = `${major}.${minor}.${patch}`;
		const dest = path.join(__dirname, 'docs', 'Release Notes', `Axway CLI ${raw}.md`);
		const { changelog, local, ts } = axwayCli.versions[ver];
		const dt = ts ? new Date(ts) : new Date();
		const rd = ts && dt.toDateString().split(' ').slice(1);
		let s = `# Axway CLI ${raw}\n\n## ${local ? 'Unreleased' : `${rd[0]} ${rd[1]}, ${rd[2]}`}\n\n`;

		if (patch === 0) {
			if (minor === 0) {
				s += 'This is a major release with breaking changes, new features, bug fixes, and dependency updates.\n\n';
			} else {
				s += 'This is a minor release with new features, bug fixes, and dependency updates.\n\n';
			}
		} else {
			s += 'This is a patch release with bug fixes and minor dependency updates.\n\n';
		}
		s += `### Installation\n\n\`\`\`\nnpm i -g axway@${cleanVersion}\n\`\`\`\n\n`
		if (changelog) {
			s += '### axway\n\n';
			s += ` * **v${cleanVersion}**${ts ? ` - ${dt.toLocaleDateString()}` : ''}\n\n`;
			s += `${changelog.split('\n').map(s => `  ${s}`).join('\n')}\n\n`;
		}

		for (const pkg of pkgs) {
			// the AMPLIFY CLI and Auth SDK are deprecated, so ignore them
			if (pkg === '@axway/amplify-cli' || pkg === '@axway/amplify-auth-sdk') {
				continue;
			}

			const vers = Object.keys(packages[pkg].versions).filter(ver => {
				const { ts } = packages[pkg].versions[ver];
				return !ts || new Date(ts) < dt;
			}).sort(semver.rcompare);

			let vs = '';
			for (const v of vers) {
				if (packages[pkg].versions[v].changelog) {
					const pts = new Date(packages[pkg].versions[v].ts);
					vs += ` * **v${v}** - ${pts.toLocaleDateString()}\n\n`;
					vs += `${packages[pkg].versions[v].changelog.split('\n').map(s => `  ${s}`).join('\n')}\n\n`;
				}
				delete packages[pkg].versions[v];
			}
			if (vs) {
				s += `### ${pkg.replace(/@.+\//, '')}\n\n${vs}`;
			}
		}

		log(`Writing release notes ${cyan(dest)}`);
		fs.outputFileSync(dest, s.trim());
	}
};
