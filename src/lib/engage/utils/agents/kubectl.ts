import { exec as execCmd } from 'child_process';

import util from 'util';
import { isWindows } from '../utils.js';
import logger from '../../../logger.js';

const quotes = isWindows ? '"' : '\'';
const log = logger('central: kubectl');

export const exec = util.promisify(execCmd);

export type KubectlResponse = {
	data: string[];
	error: null | string;
};

type ExecResponse = {
	data: null | string;
	error: null | string;
};

class Kubectl {
	async get(resource: string, args?: string): Promise<KubectlResponse> {
		return await this.invoke('get', resource, args);
	}

	async create(resource: string, args: string): Promise<KubectlResponse> {
		return await this.invoke('create', resource, args);
	}

	async delete(resource: string, args: string): Promise<KubectlResponse> {
		return await this.invoke('delete', resource, args);
	}

	async isInstalled(): Promise<ExecResponse> {
		return await this.execKubectl('version', 'version');
	}

	private async invoke(action: string, resource: string, args?: string): Promise<KubectlResponse> {
		const obj: KubectlResponse = { error: null, data: [] };
		let logMsg = `kubectl ${action} ${resource}`;
		logMsg = args ? (logMsg += ` ${args}`) : logMsg;
		log(logMsg);

		const res = await this.execKubectl(`${action} ${resource} ${args || ''}`, resource);
		if (res.error) {
			obj.error = res.error;
			log(`command failed: ${res.error}`);
			return obj;
		}
		obj.data = this.cleanResponse(res.data!);
		log('command success');
		return obj;
	}

	private async execKubectl(action: string, resource: string): Promise<ExecResponse> {
		// eslint-disable-next-line prefer-const
		let { stdout, stderr } = await exec(`kubectl ${action} | awk ${quotes}{print $1}${quotes}`);
		if (stderr.includes('WARNING')) {
			stderr = '';
		}
		return stderr ? { data: null, error: `K8S ${resource}: ${stderr}` } : { data: stdout, error: null };
	}

	private cleanResponse(res: string) {
		return res
			.split('\n')
			.filter((str) => str !== 'NAME' && str !== '')
			.sort();
	}
}

export const kubectl = new Kubectl();
