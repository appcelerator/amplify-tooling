import snooplogg from 'snooplogg';
import { createTable } from '@axway/amplify-cli-utils';

const { green, highlight } = snooplogg.styles;
const check = process.platform === 'win32' ? '√' : '✔';

/**
 * Renders region, organizations, roles, and teams for the specified account
 *
 * @param {Object} account - The account object.
 * @param {Config} config - The Amplify config object.
 * @param {AmplifySDK} sdk - The Amplify SDK instance.
 */
export async function renderAccountInfo(account, config, sdk) {
	let s = `The current region is set to ${highlight(config.get('region', account.org?.region || 'US'))}.\n`;

	if (account.orgs?.length) {
		const table = createTable([ 'Organization', 'GUID', 'ID' ]);
		for (const { default: def, guid, id, name } of account.orgs) {
			table.push([
				def ? green(`${check} ${name}`) : `  ${name}`,
				guid,
				id
			]);
		}
		s += `\n${table.toString()}\n`;
	}

	if (account.roles?.length) {
		const roles = await sdk.role.list(account);
		const table = createTable([ 'ROLES', 'DESCRIPTION', 'TYPE' ]);
		for (const role of account.roles) {
			const info = roles.find(r => r.id === role);
			table.push([
				`  ${highlight(info?.id || 'n/a')}`,
				info ? info.name : role,
				!info ? 'n/a' : info?.default ? 'Platform' : 'Service'
			]);
		}
		s += `\n${table.toString()}\n`;
	}

	if (account.team) {
		const teams = account.org.teams.sort((a, b) => {
			return a.guid === account.guid ? 1 : a.name.localeCompare(b.guid);
		});
		const table = createTable();
		for (let i = 0; i < teams.length; i++) {
			const current = teams[i].guid === account.team.guid;
			table.push([
				current ? green(`${check} ${teams[i].name}`) : `  ${teams[i].name}`,
				teams[i].guid
			]);
		}
		s += `\n"${account.org.name}" TEAMS\n${table.toString()}\n`;

		if (account.team.roles.length) {
			const roles = await sdk.role.list(account, { team: true });
			const table = createTable([ 'TEAM ROLES', 'DESCRIPTION' ]);
			for (const role of account.team.roles) {
				const info = roles.find(r => r.id === role);
				table.push([
					`  ${highlight(info?.id || 'n/a')}`,
					info ? info.name : role
				]);
			}
			s += `\n${table.toString()}\n`;
		}
	}

	return s;
}
