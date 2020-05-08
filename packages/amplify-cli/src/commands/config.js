const readActions = {
	get:     'get',
	ls:      'get',
	list:    'get'
};

const writeActions = {
	set:     'set',

	delete:  'delete',
	remove:  'delete',
	rm:      'delete',
	unset:   'delete',

	push:    'push',
	pop:     'pop',
	shift:   'shift',
	unshift: 'unshift'
};

export default {
	aliases: [ 'c' ],
	desc: 'Manage configuration options',
	options: {
		'--json': 'outputs the config as JSON'
	},
	args: [ '<action>', 'key', 'value' ],
	async action({ argv }) {
		const { loadConfig, configFile } = await import('@axway/amplify-config');

		let { action, key, value } = argv;

		if (!readActions[action] && !writeActions[action]) {
			throw new Error(`Unknown action: ${action}`);
		}

		const cfg = loadConfig(argv);
		const data = {
			action,
			key,
			value
		};

		if (writeActions[action]) {
			if (!key) {
				return printAndExit({
					value: `Error: Missing the configuration key to ${action}`,
					json: argv.json,
					exitCode: 1
				});
			}

			try {
				data.value = JSON.parse(data.value);
			} catch (e) {
				// squelch
			}

			if ((action === 'set' || action === 'push' || action === 'unshift') && data.value === undefined) {
				return printAndExit({
					value: `Error: Missing the configuration value to ${action}`,
					json: argv.json,
					exitCode: 1
				});
			}
		}

		if (readActions[action]) {
			const filter = key && key.split(/\.|\//).join('.') || undefined;
			const value = cfg.get(filter);
			if (value === undefined) {
				return printAndExit({
					key,
					value: `Not Found: ${key}`,
					json: argv.json,
					exitCode: 6
				});
			} else {
				return printAndExit({ key, value, json: argv.json });
			}
		}

		// it's a write operation

		try {
			let result = 'Saved';
			let value;
			// If it's an aliased action, then get the real action
			action = writeActions[action];
			switch (action) {
				case 'set':
					cfg.set(key, data.value);
					break;

				case 'delete':
					if (!cfg.has(key)) {
						return printAndExit({
							value: `Not Found: ${key}`,
							json: argv.json,
							exitCode: 6
						});
					} else if (!cfg.delete(key)) {
						return printAndExit({
							value: `Error: Unable to delete key "${key}"`,
							json: argv.json,
							exitCode: 1
						});
					}
					break;

				case 'push':
					cfg.push(key, data.value);
					result = cfg.get(key);
					if (!argv.json) {
						result = JSON.stringify(result);
					}
					break;

				case 'pop':
					if (!cfg.has(key)) {
						return printAndExit({
							value: `Not Found: ${key}`,
							json: argv.json,
							exitCode: 6
						});
					} else {
						value = cfg.pop(key);
						result = value || (argv.json ? null : '<empty>');
					}
					break;

				case 'shift':
					if (!cfg.has(key)) {
						return printAndExit({
							value: `Not Found: ${key}`,
							json: argv.json,
							exitCode: 6
						});
					} else {
						value = cfg.shift(key);
						result = value || (argv.json ? null : '<empty>');
					}
					break;

				case 'unshift':
					cfg.unshift(key, data.value);
					result = cfg.get(key);
					if (!argv.json) {
						result = JSON.stringify(result);
					}
					break;
			}

			await cfg.save(configFile);

			printAndExit({ value: result, json: argv.json });
		} catch (err) {
			printAndExit({
				value: argv.json ? err.message : err.toString(),
				json: argv.json,
				exitCode: 1
			});
		}
	}
};

/**
 * Prints the result.
 *
 * @param {Object} opts - Various options.
 * @param {Number} [opts.exitCode=0] - The exit code to return after printing the value.
 * @param {Boolean} [opts.json=false] - When `true`, displays the output as json.
 * @param {String} [opts.key=null] - The prefix used for the filter to prepend the keys when
 * listing the config settings.
 * @param {*} opts.value - The resulting value.
 */
async function printAndExit({ exitCode = 0, json, key = null, value }) {
	if (json) {
		console.log(JSON.stringify({
			code: exitCode,
			result: value
		}, null, 2));
	} else if (value && typeof value === 'object') {
		let width = 0;
		const rows = [];

		(function walk(scope, segments) {
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
		}(value, key ? key.split('.') : []));

		if (rows.length) {
			for (const row of rows) {
				console.log(row[0].padEnd(width) + ' = ' + row[1]);
			}
		} else {
			console.log('No config settings found');
		}
	} else {
		console.log(value);
	}

	process.exit(exitCode);
}
