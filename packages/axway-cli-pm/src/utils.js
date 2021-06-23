import Listr from 'listr';
import { ansi, snooplogg } from 'cli-kit';

/**
 * Highlights the difference between two versions.
 *
 * @param {String} toVer - The latest version.
 * @param {String} fromVer - The current version.
 * @returns {String}
 */
export function hlVer(toVer, fromVer) {
	const { green } = snooplogg.styles;
	const version = [];

	let [ from, fromTag ] = fromVer.split(/-(.+)/);
	from = from.replace(/[^.\d]/g, '').split('.').map(x => parseInt(x));

	let [ to, toTag ] = toVer.split(/-(.+)/);
	const toMatch = to.match(/^([^\d]+)?(.+)$/);
	to = (toMatch ? toMatch[2] : to).split('.').map(x => parseInt(x));

	const tag = () => {
		if (toTag) {
			const toNum = toTag.match(/\d+$/);
			const fromNum = fromTag && fromTag.match(/\d+$/);
			if (fromNum && parseInt(fromNum[0]) >= parseInt(toNum)) {
				return `-${toTag}`;
			} else {
				return green(`-${toTag}`);
			}
		}
		return '';
	};

	while (to.length) {
		if (to[0] > from[0]) {
			if (version.length) {
				return (toMatch && toMatch[1] || '') + version.concat(green(to.join('.') + tag())).join('.');
			}
			return green((toMatch && toMatch[1] || '') + to.join('.') + tag());
		}
		version.push(to.shift());
		from.shift();
	}

	return (toMatch && toMatch[1] || '') + version.join('.') + tag();
}

/**
 * Custom Listr renderer for non-TTY environments.
 */
export class ListrTextRenderer {
	constructor(tasks, options) {
		this._tasks = tasks;
		this._console = options?.console || console;
	}

	static get nonTTY() {
		return true;
	}

	render() {
		this._console.error(ansi.cursor.hide);

		for (const task of this._tasks) {
			task.subscribe(
				event => {
					if (event.type === 'STATE') {
						const message = task.isPending() ? 'started' : task.state;
						this._console.log(`${task.title} [${message}]`);
					} else if (event.type === 'TITLE') {
						this._console.log(`${task.title}`);
					}
				},
				err => this._console.error(err)
			);
		}
	}

	end() {
		this._console.error(ansi.cursor.show);
	}
}

/**
 * Creates a Listr instance with the appropriate settings and executes the tasks.
 *
 * @param {Object} params - Various parameters.
 * @param {Object} params.console - The console instance.
 * @param {Boolean} params.json - When `true`, indicates JSON mode and thus silence Listr rendering.
 * @param {Array.<Object>} params.tasks - A list of tasks to execute.
 * @returns {Promise}
 */
export async function runListr({ console, json, tasks }) {
	await (new Listr(tasks, {
		concurrent: 10,
		console,
		dateFormat: false,
		exitOnError: false,
		renderer: json ? 'silent' : process.stdout.isTTY === true ? 'default' : ListrTextRenderer
	})).run();
}
