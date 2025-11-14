import Command from '../../../lib/command.js';
import { createTable } from '../../../lib/formatter.js';
import { highlight } from '../../../lib/logger.js';

const defaultProfileName = '[default]';

export default class ConfigProfileList extends Command {
	static override aliases = [
		'config:profile:ls'
	];

	static override summary = 'Display all profiles.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %>',
			description: 'List all profiles.'
		},
		{
			command: '<%= config.bin %> <%= command.id %> --json',
			description: 'Return the profiles as JSON.'
		}
	];

	static override authenticated = false;
	static override enableJsonFlag = true;
	static override enableProfileFlag = false;

	async run(): Promise<void | any> {
		const { config } = await this.parse(ConfigProfileList);
		const configData = config.data();

		const profiles = [];
		if (configData.auth && configData.auth.platformUrl) {
			profiles.push({ name: defaultProfileName, url: configData.auth.platformUrl, region: configData.auth.region });
		}
		for (const [ profileName, profileData ] of Object.entries(configData.profiles || {}) as [string, any]) {
			if (profileData?.auth?.platformUrl) {
				profiles.push({ name: profileName, url: profileData.auth.platformUrl, region: profileData.auth.region });
			}
		}
		if (this.jsonEnabled()) {
			return profiles;
		}

		const table = createTable([ 'Profile', 'Platform URL', 'Region', 'Use' ]);
		for (const profile of profiles) {
			table.push([
				profile.name,
				profile.url,
				profile.region,
				`$ ${highlight(`${this.config.bin} [COMMAND]${profile.name === defaultProfileName ? '' : ` --profile ${profile.name}`}`)}`
			]);
		}
		this.log(table.toString());
	}
}
