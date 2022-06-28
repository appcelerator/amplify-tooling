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