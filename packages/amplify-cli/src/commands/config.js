import { loadConfig, locations } from '@axway/amplify-cli-utils';

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
	desc: 'get and set config options',
	options: {
		'--json': 'outputs the config as JSON'
	},
	args: [ 'action', 'key', 'value' ],
	async action({ argv }) {
		const cfg = loadConfig(argv);
		let { action, key, value } = argv;
		if (!readActions[action] && !writeActions[action]) {
			key = action;
			action = 'get';
		}

		const data = {
			action,
			key,
			value
		};

		if (writeActions[action]) {
			if (!key) {
				printAndExit(null, `Error: Missing the configuration key to ${action}`, argv.json, 1);
			}

			try {
				data.value = JSON.parse(data.value);
			} catch (e) {
				// squelch
			}

			if ((action === 'set' || action === 'push' || action === 'unshift') && data.value === undefined) {
				printAndExit(null, `Error: Missing the configuration value to ${action}`, argv.json, 1);
			}
		}

		if (action === 'get') {
			const filter = key && key.split(/\.|\//).join('.') || undefined;
			const value = cfg.get(filter);
			if (value === undefined) {
				printAndExit(key, `Not Found: ${key}`, argv.json, 6);
			} else {
				printAndExit(key, value, argv.json);
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
						printAndExit(null, `Not Found: ${key}`, argv.json, 6);
					} else if (!cfg.delete(key)) {
						printAndExit(null, `Error: Unable to delete key "${key}"`, argv.json, 1);
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
						printAndExit(null, `Not Found: ${key}`, argv.json, 6, '404');
					} else {
						value = cfg.pop(key);
						result = value || (argv.json ? null : '<empty>');
					}
					break;

				case 'shift':
					if (!cfg.has(key)) {
						printAndExit(null, `Not Found: ${key}`, argv.json, 6, '404');
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

			await cfg.save(locations.configFile);

			printAndExit(null, result, argv.json);
		} catch (err) {
			printAndExit(null, argv.json ? err.message : err.toString(), argv.json, 1);
		}
	}
};

/**
 * Prints the result.
 *
 * @param {String?} key - The prefix used for the filter to prepend the keys when listing the config
 * settings.
 * @param {*} value - The resulting value.
 * @param {Boolean} [json=false] - When `true`, displays the output as json.
 * @param {Number} [exitCode=0] - The exit code to return after printing the value.
 * @param {Number} [code=0] - The code to return in a json response
 */
function printAndExit(key, value, json, exitCode = 0) {
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

		for (const row of rows) {
			console.log(row[0].padEnd(width) + ' = ' + row[1]);
		}
	} else {
		console.log(value);
	}

	process.exit(exitCode);
}
