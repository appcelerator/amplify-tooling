import { readFileSync, writeFileSync } from 'fs';
import tmp from 'tmp';
import { parseAsYaml } from '../results/resultsrenderer.js';
import { isWindows } from '../utils/utils.js';
import { editor } from '../utils/bash-commands.js';
import logger from '../../logger.js';

const log = logger('engage:utils:tmp-file');

export default class TmpFile {
	private file: tmp.FileResultNoFd;
	public path: string;

	/**
	 * Init temporary file if "data" is provided - write data to file (as YAML at the moment)
	 * @param {object} data optional data to write while creating file
	 */
	constructor(data?: object) {
		log('creating a new file');
		// discardDescriptor = true is required for windows (fixes "file is open by another process" error).
		this.file = tmp.fileSync({ discardDescriptor: true, prefix: 'axway-central-edit-', postfix: '.yaml' });
		this.path = this.file.name;
		log(`file created at: ${this.path}`);
		// if data is provided write it to the file as YAML
		if (data) {
			this.write(parseAsYaml(data));
		}
	}

	/**
	 * Delete tmp file
	 */
	delete(): void {
		log(`removing: ${this.path}`);
		this.file.removeCallback();
	}

	/**
	 * Write to file
	 * @param {string} data data to write
	 */
	write(data: string): void {
		log(`writing to: ${this.path}`);
		writeFileSync(this.path, data);
	}

	/**
	 * Read file as string (as is)
	 * @return {string} data from file
	 */
	read(): string {
		log(`reading from: ${this.path}`);
		return readFileSync(this.path, 'utf8');
	}

	/**
	 * Open file in editor and return promise with flags indicating if edit was successful or not
	 * (process killed, vim q! happened etc. ), and if file content has been changed or not.
	 * Using vim or "EDITOR" env on linux and only notepad on windows.
	 * @returns {object} represent result of editing:
	 * isComplete: editor process completed successfully
	 * isUpdated: content of the file changed
	 */
	async edit(): Promise<{ isComplete: boolean; isUpdated: boolean }> {
		log(`editing: ${this.path}`);
		const editorToUse = isWindows ? 'notepad' : process.env.EDITOR || 'vi';
		const contentBeforeEdit = Buffer.from(this.read());
		const editorExitCode = await editor(editorToUse, this.path);
		const isUpdated = !contentBeforeEdit.equals(Buffer.from(this.read()));

		if (editorExitCode === 0) {
			log('file edit has been successful');
			return { isComplete: true, isUpdated };
		} else {
			log(`file edit error, code: ${editorExitCode}`);
			return { isComplete: false, isUpdated };
		}
	}
}
