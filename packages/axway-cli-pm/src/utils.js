import Listr from 'listr';
import { ansi } from 'cli-kit';

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
