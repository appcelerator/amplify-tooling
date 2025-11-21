import { active, highlight, note } from '../../lib/logger.js';
import { createTable } from '../formatter.js';

const check = process.platform === 'win32' ? '√' : '✔';

/**
 * Renders region, organizations, roles, and teams for the specified account
 *
 * @param {Object} account - The account object.
 * @param {Config} config - The Amplify config object.
 * @param {AmplifySDK} sdk - The Amplify SDK instance.
 */
export async function renderAccountInfo(account, config, sdk) {
	let s = `The current region is set to ${highlight(config.get('region', account.org?.region || 'US'))}.`;

	if (account.org?.guid) {
		const table = createTable([ 'Organization', 'GUID', 'ORG ID' ]);
		table.push([
			account.org.name,
			account.org.guid,
			account.org.org_id
		]);
		s += `\n\n${table.toString()}`;
	}

	if (account.roles?.length) {
		const roles = await sdk.role.list(account);
		const table = createTable([ 'ROLES', 'DESCRIPTION', 'TYPE' ]);
		for (const role of account.roles) {
			const info = roles.find(r => r.id === role);
			table.push([
				`  ${info?.id ? info.id : note('n/a')}`,
				info ? info.name : role,
				!info ? note('n/a') : info?.default ? 'Platform' : 'Service'
			]);
		}
		s += `\n\n${table.toString()}`;
	}

	if (account.team) {
		const teams = account.org.teams.sort((a, b) => {
			return a.guid === account.guid ? 1 : a.name.localeCompare(b.guid);
		});
		const table = createTable([ 'Teams', 'GUID', 'Role' ]);
		for (let i = 0; i < teams.length; i++) {
			const current = teams[i].guid === account.team.guid;
			table.push([
				current ? active(`${check} ${teams[i].name}`) : `  ${teams[i].name}`,
				teams[i].guid,
				account.user.guid && teams[i].users.find(u => u.guid === account.user.guid)?.roles.join(', ') || note('n/a')
			]);
		}
		s += `\n\n${table.toString()}`;
	}

	return s;
}
