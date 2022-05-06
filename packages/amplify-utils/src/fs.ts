import fs from 'fs';
import path from 'path';

type ExecuteOptions = {
	applyOwner?: boolean,
	gid?: number,
	uid?: number
}

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
function execute(dest: string, opts: ExecuteOptions, fn: (opts: ExecuteOptions) => void) {
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
			chownSync(dest, opts.uid as number, opts.gid as number);
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
export function existsSync(file: string) {
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
export function isDir(dir: string) {
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
export function isFile(file: string) {
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
export function mkdirpSync(dest: string, opts = {}) {
	execute(dest, opts, opts => {
		fs.mkdirSync(dest, { mode: 0o777, ...opts, recursive: true });
	});
}

/**
 * Moves a file.
 *
 * @param {String} src - The file or directory to move.
 * @param {String} dest - The destination to move the file or directory to.
 * @param {Object} [opts] - Various options plus options to pass into `fs.mkdirSync()` and
 * `fs.renameSync()`.
 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
 * existing parent directory and apply the owner to the file and any newly created directories.
 * @param {Number} [opts.gid] - The group id to apply to the file when assigning an owner.
 * @param {Number} [opts.uid] - The user id to apply to the file when assigning an owner.
 */
export function moveSync(src: string, dest: string, opts = {}) {
	execute(dest, opts, opts => {
		mkdirpSync(path.dirname(dest), opts);
		fs.renameSync(src, dest);
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
export function writeFileSync(dest: string, contents: string, opts = {}) {
	execute(dest, opts, opts => {
		mkdirpSync(path.dirname(dest), { ...opts, mode: undefined });
		fs.writeFileSync(dest, contents, opts as object);
	});
}
