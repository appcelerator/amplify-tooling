export default {
	aliases: [ 'conf' ],
	commands: {
		'@ls, list': {
			desc: 'Display all config settings',
			action: ctx => runConfig('get', ctx)
		},
		'get [key]': {
			desc: 'Display a specific config setting',
			action: ctx => runConfig('get', ctx)
		},
		'set <key> <value>': {
			desc: 'Change a config setting',
			action: ctx => runConfig('set', ctx)
		},
		'@rm, delete, !remove, !unset <key>': {
			desc: 'Remove a config setting',
			action: ctx => runConfig('delete', ctx)
		},
		'push <key> <value>': {
			desc: 'Add a value to the end of a list',
			action: ctx => runConfig('push', ctx)
		},
		'pop <key>': {
			desc: 'Remove the last value in a list',
			action: ctx => runConfig('pop', ctx)
		},
		'shift <key>': {
			desc: 'Remove the first value in a list',
			action: ctx => runConfig('shift', ctx)
		},
		'unshift <key> <value>': {
			desc: 'Add a value ot the beginning of a list',
			action: ctx => runConfig('unshift', ctx)
		}
	},
	desc: 'Manage configuration options',
	help: {
		header() {
			return `${this.desc}.`;
		},
		footer: ({ style }) => `${style.heading('Examples:')}

  List all config settings:
    ${style.highlight('amplify config ls')}

  Return the config as JSON:
    ${style.highlight('amplify config ls --json')}

  Get a specific config setting:
    ${style.highlight('amplify config get home')}

  Set a config setting:
    ${style.highlight('amplify config set env production')}`
	},
	options: {
		'--json': 'outputs the config as JSON'
	}
};

async function runConfig(action, { argv, cmd, console, setExitCode }) {
	const { loadConfig } = await import('@axway/amplify-config');

	let { json, key, value } = argv;
	const cfg = loadConfig(argv);
	const data = { action, key, value };
	const filter = key && key.split(/\.|\//).filter(Boolean).join('.') || undefined;

	if (typeof data.value === 'string') {
		try {
			data.value = JSON.parse(data.value);
		} catch (e) {
			// squelch
		}
	}

	const print = ({ code = 0, key = null, value }) => {
		setExitCode(code);
		cmd.banner = false;

		if (json) {
			console.log(JSON.stringify(value, null, 2));
		} else if (value && typeof value === 'object') {
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
			}(value, key ? key.split('.') : []));

			if (rows.length) {
				for (const row of rows) {
					console.log(`${row[0].padEnd(width)} = ${row[1]}`);
				}
			} else {
				console.log('No config settings found');
			}
		} else {
			console.log(value);
		}
	};

	// in general, we do not want to show the help screen for the errors below
	// since they are valid messages and we're just using errors for flow control
	cmd.showHelpOnError = false;

	try {
		if (action === 'get') {
			const value = cfg.get(filter);
			print({ code: value === undefined ? 6 : 0, key: filter || key, value });
		} else {
			// it's a write operation
			let result = 'OK';

			switch (action) {
				case 'set':
					cfg.set(key, data.value);
					break;

				case 'delete':
					cfg.delete(key);
					break;

				case 'push':
					cfg.push(key, data.value);
					break;

				case 'pop':
					result = cfg.pop(key);
					break;

				case 'shift':
					result = cfg.shift(key);
					break;

				case 'unshift':
					cfg.unshift(key, data.value);
					break;
			}

			cfg.save();

			print({ value: result });
		}
	} catch (err) {
		if (json) {
			cmd.showHelpOnError = false;
			err.json = json;
		}
		throw err;
	}
}
