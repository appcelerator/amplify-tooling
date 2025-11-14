import Command from '../../lib/command.js';

export default class ConfigList extends Command {
	static override aliases = [ 'config:ls' ];

	static override summary = 'Display all config settings.';

	static override examples = [
		{
			command: '<%= config.bin %> <%= command.id %>',
			description: 'List all config settings.'
		},
		{
			command: '<%= config.bin %> <%= command.id %> --json',
			description: 'Return the config as JSON.'
		}
	];

    static override authenticated = false;
	static override enableJsonFlag = true;

	async run() {
        const { config } = await this.parse(ConfigList);
		const configData = await config.data();
		if (this.jsonEnabled()) {
			return configData;
		}
		if (configData && typeof configData === 'object') {
			let width = 0;
			const rows = [];
			(function walk(scope, segments) {
				if (Array.isArray(scope) && !scope.length) {
					const path = segments.join('.');
					width = Math.max(width, path.length);
					rows.push([ path, '[]' ]);
					return;
				}
				for (const key of Object.keys(scope).sort()) {
					segments.push(key);
					if (scope[key] && typeof scope[key] === 'object') {
						walk(scope[key], segments);
					} else {
						const path = segments.join('.');
						width = Math.max(width, path.length);
						rows.push([ path, scope[key] ]);
					}
					segments.pop();
				}
			}(configData, []));
			if (rows.length) {
				for (const row of rows) {
					this.log(`${row[0].padEnd(width)} = ${row[1]}`);
				}
			} else {
				this.log('No config settings found');
			}
		} else {
			this.log(configData);
		}
	}
}
