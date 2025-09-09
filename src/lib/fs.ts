import fs from 'fs';
import path from 'path';

/**
 * Determines owner of existing parent directory, calls the operation's function, then applies the
 * owner to the destination and its newly created parent directories.
 *
 * @param {String} dest - The destination of the file or directory the operation is targetting.
 * @param {Object} opts - Various options.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 * @param {Function} fn - A function to call to perform the original filesystem operation.
 */
function execute(dest, opts, fn) {
	if (opts.applyOwner === false || process.platform === 'win32' || !process.getuid || process.getuid() !== 0) {
		fn(opts);
		return;
	}

	dest = path.resolve(dest);
	let origin = path.parse(dest).root;

	if (!opts.uid) {
		for (origin = dest; true; origin = path.dirname(origin)) {
			try {
				const st = fs.lstatSync(origin);
				if (st.isDirectory()) {
					opts = Object.assign({}, opts, { gid: st.gid, uid: st.uid });
					break;
				}
			} catch (err) {
				// continue
			}
		}
	}

	fn(opts);

	const chownSync = fs.lchownSync || fs.chownSync;
	let stat = fs.lstatSync(dest);
	while (dest !== origin && stat.uid !== opts.uid) {
		try {
			chownSync(dest, opts.uid, opts.gid);
			dest = path.dirname(dest);
			stat = fs.lstatSync(dest);
		} catch (e) {
			break;
		}
	}
}

/**
 * Determines if a file or directory exists.
 *
 * @param {String} file - The full path to check if exists.
 * @returns {Boolean}
 */
export function existsSync(file) {
	try {
		fs.statSync(file);
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Determines if a directory exists and that it is indeed a directory.
 *
 * @param {String} dir - The directory to check.
 * @returns {Boolean}
 */
export function isDir(dir) {
	try {
		return fs.statSync(dir).isDirectory();
	} catch (e) {
		// squelch
	}
	return false;
}

/**
 * Determines if a file exists and that it is indeed a file.
 *
 * @param {String} file - The file to check.
 * @returns {Boolean}
 */
export function isFile(file) {
	try {
		return fs.statSync(file).isFile();
	} catch (e) {
		// squelch
	}
	return false;
}

/**
 * Creates a directory and any parent directories if needed.
 *
 * @param {String} dest - The directory path to create.
 * @param {Object} [opts] - Various options plus options to pass into `fs.mkdirSync()`.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 */
export function mkdirpSync(dest, opts = {}) {
	execute(dest, opts, opts => {
		fs.mkdirSync(dest, { mode: 0o777, ...opts, recursive: true });
	});
}

/**
 * Writes a file to disk.
 *
 * @param {String} dest - The name of the file to write.
 * @param {String} contents - The contents of the file to write.
 * @param {Object} [opts] - Various options plus options to pass into `fs.mkdirSync()` and
 * `fs.writeFileSync()`.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 */
export function writeFileSync(dest, contents, opts = {}) {
	execute(dest, opts, opts => {
		mkdirpSync(path.dirname(dest), { ...opts, mode: undefined });
		fs.writeFileSync(dest, contents, opts);
	});
}
