'use strict';

const chug         = require('gulp-chug');
const debug        = require('gulp-debug');
const fs           = require('fs-extra');
const gulp         = require('gulp');
const log          = require('fancy-log');
const path         = require('path');
const plumber      = require('gulp-plumber');
const spawnSync    = require('child_process').spawnSync;
const tmp          = require('tmp');
const util         = require('util');

const { join }     = require('path');
const { series } = gulp;

const nodeInfo = exports['node-info'] = async function nodeInfo() {
	log(`Node.js ${process.version} (${process.platform})`);
	log(process.env);
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
exports.test = series(nodeInfo, build, function test() {
	return runTests();
});
exports.coverage = series(nodeInfo, build, function coverage() {
	return runTests(true, true);
});

async function runTests(cover, all) {
	process.env.APPCD_TEST_GLOBAL_PACKAGE_DIR = path.join(__dirname, 'packages');
	process.env.SNOOPLOGG = '*';
	const runner = require('appcd-gulp/src/test-runner');
	return runner.runTests({ root: __dirname, projectDir: __dirname, cover, all });
}

function integration({ amplifyBin, amplifyConfigFile }) {
	return async () => {
		const args = [];
		const mocha = require.resolve('mocha');

		let axwayHomeDir;
		if (process.argv.includes('--axway-home')) {
			const argIndex = process.argv.indexOf('--axway-home-parent') + 1;
			const homeArg = process.argv[argIndex];
			if (!homeArg) {
				log('A directory must be specified with the "--axway-home-parent" flag');
				process.exit(1);
			}
			if (!fs.existsSync(homeArg)) {
				log(`The supplied argument for "--axway-home-parent" "${homeArg}" does not exist.`);
				process.exit(1);
			}
			axwayHomeDir = homeArg;
		} else {
			tmp.setGracefulCleanup();
			axwayHomeDir = tmp.dirSync({ unsafeCleanup: true }).name;
		}

		if (!process.argv.includes('--use-global')) {
			process.env.AMPLIFY_BIN = amplifyBin;
			process.env.AMPLIFY_CONFIG_FILE = path.join(axwayHomeDir, amplifyConfigFile);
		}

		process.env.HOME = axwayHomeDir;
		process.env.USERPROFILE = axwayHomeDir;

		if (!mocha) {
			log('Unable to find mocha!');
			process.exit(1);
		}
		args.push(path.join(mocha, '..', 'bin', 'mocha'));
		args.push('integration-tests/test-*.js');
		log('Running: ' + process.execPath + ' ' + args.join(' '));

		if (spawnSync(process.execPath, args, { stdio: 'inherit' }).status) {
			const err = new Error('At least one test failed :(');
			err.showStack = false;
			throw err;
		}
	};
}

exports.integration = series(
	nodeInfo,
	build,
	integration({
		amplifyBin: join(__dirname, 'packages', 'axway-cli', 'bin', 'axway'),
		amplifyConfigFile: path.join('.axway', 'axway-cli', 'config.json')
	}),
	integration({
		amplifyBin: join(__dirname, 'packages', 'amplify-cli', 'bin', 'amplify'),
		amplifyConfigFile: path.join('.axway', 'amplify-cli.json')
	})
);

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

	const packages = {
		'axway': { latest: null, releases: {} }
	};
	const re = /^@axway\//;
	const tempDir = tmp.dirSync({
		mode: '755',
		prefix: 'axway-cli-release-notes-',
		unsafeCleanup: true
	}).name;

	const fetch = async name => {
		log(`Fetching ${cyan(name)}`);
		return JSON.parse(spawnSync('npm', [ 'view', name, '--json' ]).stdout.toString());
	};

	const getReleases = async name => {
		if (packages[name] || !re.test(name)) {
			return;
		}

		const { time } = await fetch(name);
		packages[name] = { latest: null, releases: {} };

		for (const [ ver, ts ] of Object.entries(time)) {
			if (semver.valid(ver) && semver.gt(ver, '0.0.0')) {
				const { prerelease } = semver.parse(ver);
				if (!prerelease || !prerelease.length) {
					packages[name].releases[ver] = { changelog: null, ts };
				}
			}
		}

		const latest = Object.keys(packages[name].releases).sort(semver.compare).pop();
		packages[name].latest = latest;

		const release = await fetch(`${name}@${latest}`);
		for (const type of [ 'dependencies', 'devDependencies' ]) {
			if (release[type]) {
				for (const name of Object.keys(release[type])) {
					await getReleases(name);
				}
			}
		}
	};

	try {
		// Step 1: get all the `axway` releases and their `@axway/*` dependencies
		let versions = (await fetch('@axway/amplify-cli')).time;
		for (const [ ver, ts ] of Object.entries(versions)) {
			if (semver.valid(ver) && semver.gt(ver, '0.0.0')) {
				const { prerelease } = semver.parse(ver);
				if (!prerelease || !prerelease.length) {
					packages['axway'].releases[ver] = { changelog: null, ts };

					const release = await fetch(`@axway/amplify-cli@${ver}`);
					for (const type of [ 'dependencies', 'devDependencies' ]) {
						if (release[type]) {
							for (const name of Object.keys(release[type])) {
								await getReleases(name);
							}
						}
					}
				}
			}
		}

		// this is a hack for v2 prerelease
		versions = (await fetch('axway')).time;
		for (const [ ver, ts ] of Object.entries(versions)) {
			if (semver.valid(ver) && semver.gt(ver, '0.0.0')) {
				const { version } = semver.coerce(ver);
				packages['axway'].releases[version] = { changelog: null, ts };

				const release = await fetch(`axway@${ver}`);
				for (const type of [ 'dependencies', 'devDependencies' ]) {
					if (release[type]) {
						for (const name of Object.keys(release[type])) {
							await getReleases(name);
						}
					}
				}
			}
		}

		const processChangelog = (name, changelog) => {
			const changes = changelog.split('\n\n#').map((s, i) => `${i ? '#' : ''}${s}`.trim());
			for (const chunk of changes) {
				const m = chunk.match(/^# v?([^\s\n]*)[^\n]*\n+(.+)$/s);
				if (m && packages[name].releases[m[1]]) {
					packages[name].releases[m[1]].changelog = m[2];
				}
			}
		};

		// Step 2: add in the local packages
		for (const subdir of fs.readdirSync(path.join(__dirname, 'packages'))) {
			try {
				const pkgJson = fs.readJsonSync(path.join(__dirname, 'packages', subdir, 'package.json'));
				let { name, version } = pkgJson;
				const changelog = fs.readFileSync(path.join(__dirname, 'packages', subdir, 'CHANGELOG.md')).toString();
				let ts = null;

				const m = changelog.match(/^# v([^\s]+)/);
				if (m && m[1] !== version) {
					// set release timestamp to now unless package is axway, then make it 10 seconds older
					ts = new Date(Date.now() + (name === 'axway' || name === '@axway/amplify-cli' ? 10000 : 0));
					version = m[1];
				}

				// another v2 prerelease hack
				version = semver.coerce(version).version;
				if (name === '@axway/amplify-cli') {
					name = 'axway';
				}

				if (!packages[name]) {
					packages[name] = { latest: null, releases: {} };
				}
				packages[name].local = true;

				if (!packages[name].releases[version]) {
					packages[name].releases[version] = { changelog: null, ts };
				}
				packages[name].releases[version].local = true;

				if (changelog) {
					processChangelog(name, changelog);
				}
			} catch (e) {}
		}

		// Step 3: for each package, fetch the latest npm package and extract the changelog
		for (const [ pkg, info ] of Object.entries(packages)) {
			if (!packages[pkg].latest) {
				packages[pkg].latest = Object.keys(info.releases).sort(semver.compare).pop();
			}

			if (info.local) {
				continue;
			}

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
	} finally {
		fs.removeSync(tempDir);
	}

	const axwayCli = packages['axway'];
	delete packages['axway'];
	const pkgs = Object.keys(packages).sort();

	// Step 4: loop over every `axway` release and generate the changelog
	for (const ver of Object.keys(axwayCli.releases).sort(semver.compare)) {
		const { raw } = semver.coerce(ver);
		if (semver.lt(raw, '2.0.0')) {
			continue;
		}
		const { minor, patch } = semver.parse(ver);
		const dest = path.join(__dirname, 'docs', 'Release Notes', `Axway CLI ${raw}.md`);
		const { changelog, local, ts } = axwayCli.releases[ver];
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
		s += `### Installation\n\n\`\`\`\nnpm i -g axway@${raw}\n\`\`\`\n\n`
		if (changelog) {
			s += `### axway@${raw}\n\n${changelog}\n\n`;
		}

		for (const pkg of pkgs) {
			const vers = Object.keys(packages[pkg].releases).filter(ver => {
				const { ts } = packages[pkg].releases[ver];
				return !ts || new Date(ts) < dt;
			}).sort(semver.compare);

			for (const v of vers) {
				if (packages[pkg].releases[v].changelog) {
					s += `### ${pkg.replace(/@.+\//, '')}@${v}\n\n${packages[pkg].releases[v].changelog}\n\n`;
				}
				delete packages[pkg].releases[v];
			}
		}

		log(`Writing release notes ${cyan(dest)}`);
		fs.outputFileSync(dest, s.trim());
	}
};
