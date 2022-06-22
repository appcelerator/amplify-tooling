import { ansi } from 'cli-kit';
import {
	Listr,
	ListrEvent,
	ListrOptions,
	ListrRenderer
} from 'listr2';

export interface AxwayRunListrOptions {
	console: Console;
	json: boolean;
	tasks: any;
}

export interface AxwayListrOptions extends ListrOptions {
	console: Console;
}

/**
 * Custom Listr renderer for non-TTY environments.
 */
export class ListrTextRenderer extends ListrRenderer {
	_console: Console;
	_tasks: any;

	constructor(tasks: any, options: AxwayListrOptions) {
		super(tasks, options);
		this._console = options?.console || console;
	}

	static get nonTTY() {
		return true;
	}

	render = () => {
		this._console.error(ansi.cursor.hide);

		for (const task of this._tasks) {
			task.subscribe(
				(event: ListrEvent) => {
					if (event.type === 'STATE') {
						const message = task.isPending() ? 'started' : task.state.toLowerCase();
						this._console.log(`${task.title} [${message}]`);
					} else if (event.type === 'TITLE') {
						this._console.log(task.title);
					}
				},
				(err: any) => this._console.error(err)
			);
		}
	}

	end = () => {
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
export async function runListr({ console, json, tasks }: AxwayRunListrOptions): Promise<void> {
	await (new Listr(tasks, {
		concurrent: 10,
		console,
		dateFormat: false,
		exitOnError: false,
		renderer: json ? 'silent' : process.stdout.isTTY === true ? 'default' : ListrTextRenderer
	} as AxwayListrOptions)).run();
}
