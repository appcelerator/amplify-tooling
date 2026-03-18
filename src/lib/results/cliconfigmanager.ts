import { existsSync, outputJsonSync, readJsonSync } from 'fs-extra';
import _ from 'lodash';
import { homedir } from 'os';
import { join } from 'path';

export enum CliConfigKeys {
	APIC_DEPLOYMENT = 'apic-deployment',
	BASE_URL = 'base-url',
	ACCOUNT = 'account',
	REGION = 'region',
	PLATFORM = 'platform',
	/*
		note: "extensions" key is an object, current list of possible keys:
		extensions.apigee
		extensions.azure
		extensions.bitbucket
		extensions.github
		extensions.layer7
		extensions.mulesoft
		extensions.swaggerhub
	*/
	EXTENSIONS = 'extensions',

	// deprecated, keeping it here just for "unset" command, remove when all related functionality is gone
	CLIENT_ID = 'client-id',
}

type ConfigObject = { [k in CliConfigKeys]?: string };

export class CliConfigManager {
	static configFilePath = join(homedir(), '.axway', 'central.json');

	private saveToFile(values: ConfigObject) {
		outputJsonSync(CliConfigManager.configFilePath, values, { spaces: '\t' });
	}

	/**
	 * Temporary validator for config file content. Needed only to cleanup some values from config files for a couple of
	 * versions, remove it after some time.
	 */
	validateSavedConfigKeys() {
		const deprecatedKeys = [
			// TODO: a few other configs might be getting deprecated: https://jira.axway.com/browse/APIGOV-19737
			// CliConfigKeys.PLATFORM,
			CliConfigKeys.CLIENT_ID,
		];
		const keysToRemove = Object.keys(this.getAll()).filter((key) => deprecatedKeys.includes(key as CliConfigKeys));
		if (keysToRemove.length) {
			throw Error(
				`Following Axway Central CLI config keys has been deprecated and no longer needed: ${keysToRemove.join(', ')}
Please unset by running:
${keysToRemove.map((key) => `axway central config unset ${key}`).join('\n')}
			`
			);
		}
	}

	// Note: current validation is good for "unset" but for "set" its needed to validate the value for "extensions" (should be non-empty)
	validate(key: string) {
		// validate 'extensions' keys - should alway have dot in the mid: extensions.abc
		if (key.startsWith(`${CliConfigKeys.EXTENSIONS}`)) {
			if (!key.includes('.')) {
				throw Error(`invalid "${CliConfigKeys.EXTENSIONS}" key format.`);
			}
		} else if (!Object.values(CliConfigKeys).includes(key as CliConfigKeys)) {
			throw Error(`central configuration doesn't support the "${key}" key.`);
		}
	}

	getAll(): ConfigObject {
		return existsSync(CliConfigManager.configFilePath) ? readJsonSync(CliConfigManager.configFilePath) : {};
	}

	get(key: CliConfigKeys): string | undefined {
		return this.getAll()[key];
	}

	// TODO
	// set(key: CentralConfigKeys) {}

	unset(key: string) {
		const config = this.getAll();
		_.unset(config, key);
		this.saveToFile(config);
	}
}
