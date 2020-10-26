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
			desc: 'Add a value to the beginning of a list',
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
    ${style.highlight('axway config ls')}

  Return the config as JSON:
    ${style.highlight('axway config ls --json')}

  Get a specific config setting:
    ${style.highlight('axway config get home')}

  Set a config setting:
    ${style.highlight('axway config set env production')}

${style.heading('Settings:')}

  ${style.highlight('auth.tokenStoreType')} ${style.note('[string] (default: "secure")')}
    The type of store to persist the access token after authenticating.

    Allowed values:
      ${style.magenta('"auto"')}    Attempts to use the "secure" store, but falls back to "file" if
                secure store is unavailable.
      ${style.magenta('"secure"')}  Encrypts the access token and using a generated key which is
                stored in the system's keychain.
      ${style.magenta('"file"')}    Encrypts the access token using the embedded key.
      ${style.magenta('"memory"')}  Stores the access token in memory instead of on disk. The
                access tokens are lost when the process exits. This is intended
                for testing purposes only.
      ${style.magenta('"null"')}    Disables all forms of token persistence and simply returns the
                access token. Subsequent calls to login in the same process
                will force the authentication flow. This is intended for
                migration scripts and testing purposes only.

  ${style.highlight('env')} ${style.note('[string] (default: "prod")')}
    The name of the environment to use for all commands.

  ${style.highlight('network.caFile')} ${style.note('[string]')}
    The path to a PEM formatted certificate authority bundle used to validate
    untrusted SSL certificates.

  ${style.highlight('network.proxy')} ${style.note('[string]')}
    The URL of the proxy server. This proxy server URL is used for both HTTP
    and HTTPS requests.

    Note: If the proxy server uses a self signed certifcate, you must specify
    the network.caFile, set network.strictSSL to false, or set the environment
    variable NODE_TLS_REJECT_UNAUTHORIZED=0.

  ${style.highlight('network.strictSSL')} ${style.note('[bool] (default: true)')}
    Enforces valid TLS certificates on all outbound HTTPS requests. Set this to
    false if you are behind a proxy server with a self signed certificate.`
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
		err.json = json;
		throw err;
	}
}