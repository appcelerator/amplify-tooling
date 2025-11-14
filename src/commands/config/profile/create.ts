import { input } from '@inquirer/prompts';
import { Flags } from '@oclif/core';

import Command from '../../../lib/command.js';
import { loadConfig } from '../../../lib/config.js';
import { highlight } from '../../../lib/logger.js';
import { readJsonSync } from '../../../lib/fs.js';

export default class ConfigProfileCreate extends Command {
	static override summary = 'Create a profile.';

	static override flags = {
		name: Flags.string({
			description: 'Name of the profile to create.'
		}),
		'auth-url': Flags.string({
			description: 'Auth URL for the profile.'
		}),
		'platform-url': Flags.string({
			description: 'Platform URL for the profile.'
		}),
		'engage-url': Flags.string({
			description: 'Engage URL for the profile.'
		}),
		region: Flags.string({
			description: 'Region to which the profile is associated.'
		}),
		file: Flags.string({
			char: 'f',
			description: 'Path to a JSON file containing the profile configuration.'
		}),
		realm: Flags.string({
			description: 'Realm for the profile.',
			hidden: true
		})
	};

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %>',
			description: 'Interactively create a new profile.'
		},
		{
			command: '<%= config.bin %> <%= command.id %> --name myprofile --file ./profile.json',
			description: 'Create a new profile using a JSON file provided by the Axway Platform.'
		}
	];

	static override authenticated = false;
	static override enableProfileFlag = false;

	async run(): Promise<void | any> {
		const { flags } = await this.parse(ConfigProfileCreate);
		const cfg = await loadConfig();

		let profileFile;
		if (flags.file) {
			try {
				profileFile = readJsonSync(flags.file);
				if (!profileFile.auth?.baseUrl || !profileFile.auth?.platformUrl || !profileFile.auth?.engageUrl) {
					throw new Error('Profile file content is invalid.');
				}
			} catch (err) {
				return this.error(`Failed to read profile file: ${(err as Error).message}`);
			}
		}

		let profileName = flags.name || await input({
			message: 'Enter a name for the profile:',
			validate: input => {
				if (!input) {
					return 'Profile name cannot be empty.';
				}
				if (cfg.has(`profiles.${input}`)) {
					return 'Profile name already exists.';
				}
				return true;
			}
		});
		const profile = profileFile || {
			auth: {
				baseUrl: flags['auth-url'] || await input({
					message: 'Enter the Auth URL:',
					validate: input => (urlValidate(input) ? true : 'Auth URL must be a valid URL.')
				}),
				platformUrl: flags['platform-url'] || await input({
					message: 'Enter the Platform URL:',
					validate: input => (urlValidate(input) ? true : 'Platform URL must be a valid URL.')
				}),
				engageUrl: flags['engage-url'] || await input({
					message: 'Enter the Engage URL:',
					validate: input => (urlValidate(input) ? true : 'Engage URL must be a valid URL.')
				}),
				region: flags.region || await input({
					message: 'Enter the Region:',
					validate: input => (input ? true : 'Region cannot be empty.')
				}),
				realm: flags.realm || 'Broker'
			}
		}

		const exists = cfg.has(`profiles.${profileName}`);
		if (exists) {
			return this.error(`Profile "${profileName}" already exists.`);
		}

		cfg.set(`profiles.${profileName}`, profile);
		cfg.save();

		this.log('');
		this.log(`Profile "${highlight(profileName)}" created successfully.`);
		this.log('You can use this profile with the Axway CLI by using the --profile flag:');
		this.log(`  $ ${highlight(`${this.config.bin} [COMMAND] --profile ${profileName}`)}`);
	}
}

function urlValidate(input: string): boolean {
	try {
		new URL(input);
		return true;
	} catch {
		return false;
	}
}
