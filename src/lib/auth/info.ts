import snooplogg from 'snooplogg';
import { createTable } from '../cli-utils/index.js';

const { green, highlight, note } = snooplogg.styles;
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

	if (account.orgs?.length) {
		const table = createTable([ 'Organization', 'GUID', 'ORG ID' ]);
		for (const { default: def, guid, id, name } of account.orgs) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				guid,
				id
			]);
		}
		s += `\n\n${table.toString()}`;
	}

	if (account.roles?.length) {
		const roles = await sdk.role.list(account);
		const table = createTable([ `"${account.org.name}" ROLES`, 'DESCRIPTION', 'TYPE' ]);
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
		const table = createTable([ account.org.name ? `"${account.org.name}" Teams` : 'Teams', 'GUID', 'Role' ]);
		for (let i = 0; i < teams.length; i++) {
			const current = teams[i].guid === account.team.guid;
			table.push([
				current ? green(`${check} ${teams[i].name}`) : `  ${teams[i].name}`,
				teams[i].guid,
				account.user.guid && teams[i].users.find(u => u.guid === account.user.guid)?.roles.join(', ') || note('n/a')
			]);
		}
		s += `\n\n${table.toString()}`;
	}

	return s;
}
