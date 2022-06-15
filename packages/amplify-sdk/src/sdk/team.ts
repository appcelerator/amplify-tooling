import Base from './base.js';
import E from '../errors.js';
import {
	Account,
	OrgLike,
	OrgRef,
	OrgUser,
	Team,
	TeamInfo,
	TeamInfoChanges,
	TeamUser
} from '../types.js';
import { PlatformTeam } from './platform-types.js';

export default class AmplifySDKTeam extends Base {
	/**
	 * Creates a team in an org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} name - The name of the team.
	 * @param {Object} [info] - The team info.
	 * @param {Boolean} [info.default] - When `true`, makes this team the default.
	 * @param {String} [info.desc] - The team description.
	 * @param {Array.<String>} [info.tags] - A list of tags.
	 * @returns {Promise<Object>}
	 */
	async create(account: Account, org: OrgLike, name: string, info?: TeamInfo): Promise<{
		org: OrgRef,
		team: Team
	}> {
		const orgRef: OrgRef = this.sdk.org.resolve(account, org, true);

		if (!name || typeof name !== 'string') {
			throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
		}

		const team: PlatformTeam = await this.sdk.request('/api/v1/team', account, {
			errorMsg: 'Failed to create team',
			json: {
				...this.prepareTeamInfo(info).data,
				name,
				org_guid: orgRef.guid
			}
		}) as PlatformTeam;

		return {
			org: orgRef,
			team: {
				default:  team.default,
				desc:     team.desc,
				guid:     team.guid,
				name:     team.name,
				org_guid: orgRef.guid,
				tags:     team.tags,
				users:    [] // no users for new teams
			} as Team
		};
	}

	/**
	 * Find a team by name or guid.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team name or guid.
	 * @returns {Promise<Object>}
	 */
	async find(account: Account, org: OrgLike, team: string): Promise<{
		org: OrgRef,
		team: Team
	}> {
		const orgRef: OrgRef = this.sdk.org.resolve(account, org);
		const origTeam = team;

		if (!team || typeof team !== 'string') {
			throw E.INVALID_ARGUMENT('Expected team to be a name or guid');
		}

		const { teams } = await this.list(account, org);
		team = team.toLowerCase();

		const teamObj = teams.find(t => t.name.toLowerCase() === team || t.guid === team);
		if (!teamObj) {
			throw new Error(`Unable to find team "${origTeam}" in the "${orgRef.name}" organization`);
		}

		return {
			org: orgRef,
			team: teamObj
		};
	}

	/**
	 * List all teams in an org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number|undefined} org - The organization object, name, id, or guid.
	 * @param {String} [userGuid] - A user guid to filter teams
	 * @returns {Promise<Object>}
	 */
	async list(account: Account, org: OrgLike, userGuid?: string): Promise<{
		org?: OrgRef,
		teams: Team[]
	}> {
		const orgRef: OrgRef = this.sdk.org.resolve(account, org);
		let teams: PlatformTeam[] = await this.sdk.request(`/api/v1/team${orgRef?.org_id ? `?org_id=${orgRef.org_id}` : ''}`, account, {
			errorMsg: 'Failed to get organization teams'
		});

		if (userGuid) {
			teams = teams.filter(team => {
				return team.users.find(u => u.guid === userGuid);
			});
		}

		const { users } = await this.sdk.org.userList(account, orgRef);

		return {
			org: orgRef,
			teams: teams
				.map((team: PlatformTeam): Team => ({
					default:  team.default,
					desc:     team.desc,
					guid:     team.guid,
					name:     team.name,
					org_guid: team.org_guid,
					tags:     team.tags,
					users:    team.users
						.reduce((list, { guid, roles, type }) => {
							const user: OrgUser | undefined = users.find(u => u.guid === guid);
							if (user) {
								list.push({
									client_id: user.client_id,
									email:     user.email,
									firstname: user.firstname,
									guid,
									lastname:  user.lastname,
									name:      user.name,
									roles,
									type
								});
							}
							return list;
						}, [] as TeamUser[])
						.sort((a, b) => {
							if (a.type !== b.type) {
								return a.type === 'user' ? -1 : a.type === 'client' ? 1 : 0;
							}
							return a.name.localeCompare(b.name);
						})
				}))
				.sort((a: Team, b: Team) => a.name.localeCompare(b.name))
		};
	}

	/**
	 * Determines team info changes and prepares the team info to be sent.
	 * @param {Object} [info] - The new team info.
	 * @param {Object} [prevInfo] - The previous team info.
	 * @returns {Promise<Object>}
	 */
	prepareTeamInfo(info: TeamInfo = {}, prevInfo?: TeamInfo): {
		changes: TeamInfoChanges,
		data: TeamInfo
	} {
		if (!info || typeof info !== 'object') {
			throw E.INVALID_ARGUMENT('Expected team info to be an object');
		}

		const changes: TeamInfoChanges = {};
		const data: TeamInfo = {};

		// populate data
		if (info.default !== undefined) {
			data.default = !!info.default;
		}
		if (info.desc !== undefined) {
			data.desc = String(info.desc).trim();
		}
		if (info.name !== undefined) {
			data.name = String(info.name).trim();
		}
		if (info.tags !== undefined) {
			if (!Array.isArray(info.tags)) {
				throw E.INVALID_ARGUMENT('Expected team tags to be an array of strings');
			}
			data.tags = info.tags
				.reduce((arr, tag) => arr.concat(tag.split(',')), [] as string[])
				.map(tag => tag.trim());
		}

		// remove unchanged
		if (prevInfo) {
			for (const key of Object.keys(data)) {
				const cur = data[key as keyof TeamInfo];
				const prev = prevInfo[key as keyof TeamInfo];
				if (Array.isArray(cur)) {
					if (cur && prev && !(cur < prev || cur > prev)) {
						delete data[key as keyof TeamInfo];
					}
				} else if (cur === prev) {
					delete data[key as keyof TeamInfo];
				} else {
					changes[key] = {
						v: cur,
						p: prev
					};
				}
			}
		}

		return { changes, data };
	}

	/**
	 * Removes a team from an organization.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team or guid.
	 * @returns {Promise<Object>}
	 */
	async remove(account: Account, org: OrgLike, team: string): Promise<{
		org: OrgRef,
		team: Team
	}> {
		const result = await this.find(account, org, team);

		await this.sdk.request(`/api/v1/team/${result.team.guid}`, account, {
			errorMsg: 'Failed to remove team',
			method: 'delete'
		});

		return result;
	}

	/**
	 * Updates team information.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team or guid.
	 * @param {Object} [info] - The team info.
	 * @param {String} [info.desc] - The team description.
	 * @param {Boolean} [info.default] - When `true`, makes this team the default.
	 * @param {Array.<String>} [info.tags] - A list of tags.
	 * @returns {Promise<Object>}
	 */
	async update(account: Account, org: OrgLike, team: string, info: TeamInfo): Promise<{
		changes: TeamInfoChanges,
		org: OrgRef,
		team: Team
	}> {
		const result = await this.find(account, org, team);
		let teamObj: Team = result.team;

		const { changes, data } = this.prepareTeamInfo(info, teamObj);

		if (Object.keys(data).length) {
			const platformTeam: PlatformTeam = await this.sdk.request(`/api/v1/team/${teamObj.guid}`, account, {
				errorMsg: 'Failed to update team',
				json: data,
				method: 'put'
			});
			teamObj = {
				default:  platformTeam.default,
				desc:     platformTeam.desc,
				guid:     platformTeam.guid,
				name:     platformTeam.name,
				org_guid: platformTeam.org_guid,
				tags:     platformTeam.tags,
				users:    teamObj.users
			};
		}

		return {
			changes,
			org: result.org,
			team: teamObj
		};
	}

	/**
	 * Adds a user to a team.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team or guid.
	 * @param {String} user - The user email or guid.
	 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
	 * @returns {Promise<Object>}
	 */
	async userAdd(account: Account, org: OrgLike, team: string, user: string, roles: string[]): Promise<{
		org: OrgRef,
		team: Team,
		user: OrgUser
	}> {
		const result = await this.find(account, org, team);

		const found: OrgUser | undefined = await this.sdk.org.userFind(account, result.org.guid, user);
		if (!found) {
			throw new Error(`Unable to find the user "${user}"`);
		}

		const teamRoles: string[] = await this.sdk.role.resolve(account, roles, {
			org: result.org,
			requireRoles: true,
			team: true
		});
		const platformTeam: PlatformTeam = await this.sdk.request(`/api/v1/team/${result.team.guid}/user/${found.guid}`, account, {
			errorMsg: 'Failed to add user to organization',
			json: {
				roles: teamRoles,
				type: found.client_id ? 'client' : 'user'
			}
		});
		const { users } = await this.sdk.org.userList(account, result.org);

		return {
			org: result.org,
			team: {
				default:  platformTeam.default,
				guid:     platformTeam.guid,
				name:     platformTeam.name,
				org_guid: platformTeam.org_guid,
				tags:     platformTeam.tags,
				users:    platformTeam.users
					.reduce((list, { guid, roles, type }) => {
						const user: OrgUser | undefined = users.find(u => u.guid === guid);
						if (user) {
							list.push({
								client_id: user.client_id,
								email:     user.email,
								firstname: user.firstname,
								guid,
								lastname:  user.lastname,
								name:      user.name,
								roles,
								type
							});
						}
						return list;
					}, [] as TeamUser[])
			},
			user: found
		};
	}

	/**
	 * Finds a user in a team.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team or guid.
	 * @param {String} user - The user email or guid.
	 * @returns {Promise<Object>}
	 */
	async userFind(account: Account, org: OrgLike, team: string, user: string): Promise<{
		org: OrgRef,
		team: Team,
		user?: TeamUser
	}> {
		const { org: orgRef, team: teamObj, users } = await this.userList(account, org, team);
		user = user.toLowerCase();
		return {
			org: orgRef,
			team: teamObj,
			user: users.find(u => String(u.email).toLowerCase() === user || String(u.guid).toLowerCase() === user)
		};
	}

	/**
	 * List all users of a team.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team or guid.
	 * @returns {Promise<Object>}
	 */
	async userList(account: Account, org: OrgLike, team: string): Promise<{
		org: OrgRef,
		team: Team,
		users: TeamUser[]
	}> {
		const { org: orgRef, team: teamObj } = await this.find(account, org, team);
		return {
			org: orgRef,
			team: teamObj,
			users: teamObj.users
		};
	}

	/**
	 * Removes a user from a team.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team or guid.
	 * @param {String} user - The user email or guid.
	 * @returns {Promise<Object>}
	 */
	async userRemove(account: Account, org: OrgLike, team: string, user: string): Promise<{
		org: OrgRef,
		team: Team,
		user: TeamUser
	}> {
		const { org: orgRef, team: teamObj, user: found } = await this.userFind(account, org, team, user);

		if (!found) {
			throw new Error(`Unable to find the user "${user}"`);
		}

		await this.sdk.request(`/api/v1/team/${teamObj.guid}/user/${found.guid}`, account, {
			errorMsg: 'Failed to remove user from team',
			method: 'delete'
		});

		return {
			org: orgRef,
			team: teamObj,
			user: found
		};
	}

	/**
	 * Updates a user's role in a team.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} team - The team or guid.
	 * @param {String} user - The user email or guid.
	 * @param {Array.<String>} roles - One or more roles to assign. Must include a "default" role.
	 * @returns {Promise<Object>}
	 */
	async userUpdate(account: Account, org: OrgLike, team: string, user: string, roles: string[]): Promise<{
		org: OrgRef,
		roles: string[],
		team: Team,
		user: TeamUser
	}> {
		const { org: orgRef, team: teamObj, user: found } = await this.userFind(account, org, team, user);

		if (!found) {
			throw new Error(`Unable to find the user "${user}"`);
		}

		roles = await this.sdk.role.resolve(account, roles, { org: orgRef, requireRoles: true, team: true });

		const result: PlatformTeam = await this.sdk.request(`/api/v1/team/${teamObj.guid}/user/${found.guid}`, account, {
			errorMsg: 'Failed to update user\'s organization roles',
			json: {
				roles
			},
			method: 'put'
		});

		// update the roles in the results
		for (const user of result.users) {
			if (user.guid === found.guid) {
				found.roles = user.roles;
				for (const teamUser of teamObj.users) {
					if (teamUser.guid === found.guid) {
						teamUser.roles = user.roles;
						break;
					}
				}
				break;
			}
		}

		return {
			org: orgRef,
			roles,
			team: teamObj,
			user: found
		};
	}
}
