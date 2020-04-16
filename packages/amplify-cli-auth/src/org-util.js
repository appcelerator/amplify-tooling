import inquirer from 'inquirer';

/**
 * Common function for determining the org for a given account.
 *
 * @param {Object} opts - Various options.
 * @param {Object} opts.account - The account object containing the access token.
 * @param {Object} opts.client - The auth object.
 * @param {Object} opts.config - The config object to save the default org info into.
 * @param {Object} opts.console - The console output instance.
 * @param {Boolean} [opts.json] - When `true`, only outputs JSON responses.
 * @param {String} [opts.org] - A preferred organization id or name.
 * @return {?Object}
 */
export async function getOrg({ account, client, config, console, json, org }) {
	let result = null;

	if (!account.orgs.length) {
		return result;
	}

	if (org) {
		for (const o of account.orgs) {
			if (String(o.org_id) === org || o.name === org) {
				result = o;
				break;
			}
		}
		if (!result) {
			const error = `Unable to find organization: ${org}`;
			if (json) {
				console.log(JSON.stringify({ error }, null, '  '));
			} else {
				console.error(`${error}\n${account.name} organizations:\n${account.orgs.map(a => `  ${a.name}`).join('\n')}`);
			}
			process.exit(1);
		}
	} else if (account.orgs.length === 1) {
		// the list of orgs takes precendence over the org
		result = account.orgs[0];
	} else if (json) {
		console.log(JSON.stringify({ error: 'Must specify --org when --json is set and the selected account has multiple organizations' }, null, '  '));
		process.exit(1);
	} else if (account.orgs.length > 1) {
		const { selected } = await inquirer.prompt({
			type: 'list',
			name: 'selected',
			message: 'Please choose an organization:',
			choices: account.orgs.map(org => ({
				name: `${org.name} (${org.org_id})`,
				value: org
			}))
		});
		result = selected;
		console.log();
	}

	if (account.org && account.org.org_id !== result.org_id) {
		// need to switch org
		result = await client.switchOrg({
			accessToken: account.tokens.access_token,
			account,
			orgId:       result.org_id
		});

		if (account.user.is2FAEnabled) {
			console.log('Two-factor authentication is enabled, please check your email or SMS messages for your authorization code.');
			const { code } = await inquirer.prompt([
				{
					type: 'input',
					name: 'code',
					message: 'Authorization code:',
					validate(s) {
						return s ? true : 'Please enter an authorization code';
					}
				}
			]);
			console.log();

			await client.sendAuthCode({
				accessToken: account.tokens.access_token,
				code: code.trim()
			});
		}
	}

	if (result) {
		config.set(`auth.defaultOrg.${account.hash}`, result.org_id);
		// await config.save(config.userConfigFile);
	}

	return result;
}
