import Base from './base.js';
import crypto from 'crypto';
import E from '../errors.js';
import { Account, Client, ClientRef, ClientTeam, OrgLike, OrgRef, Team } from '../types.js';
import { PlatformClient } from './platform-types.js';
import { promisify } from 'util';

interface PlatformClientPayload {
	description?: string,
	name?: string,
	org_guid?: string,
	publicKey?: string,
	roles?: string[],
	secret?: string,
	teams?: ClientTeam[],
	type?: string
}

export default class AmplifySDKClient extends Base {
	/**
	 * Creates a new service account.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object} opts - Various options.
	 * @param {String} [opts.desc] - The service account description.
	 * @param {String} opts.name - The display name.
	 * @param {String} [opts.publicKey] - A PEM formatted public key.
	 * @param {Array<String>} [opts.roles] - A list of roles to assign to the service account.
	 * @param {String} [opts.secret] - A client secret key.
	 * @param {Array<Object>} [opts.teams] - A list of objects containing `guid` and `roles`
	 * properties.
	 * @returns {Promise<Object>}
	 */
	async create(account: Account, org: OrgLike, opts: {
		desc?: string,
		name: string,
		publicKey?: string,
		roles?: string[],
		secret?: string,
		teams?: ClientTeam[]
	}): Promise<{ client: Client, org: OrgRef }> {
		const orgRef: OrgRef = this.sdk.org.resolve(account, org, true);

		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		if (!opts.name || typeof opts.name !== 'string') {
			throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
		}

		if (opts.desc && typeof opts.desc !== 'string') {
			throw E.INVALID_ARGUMENT('Expected description to be a string');
		}

		const data: PlatformClientPayload = {
			description: opts.desc || '',
			name:        opts.name,
			org_guid:    orgRef.guid
		};

		if (opts.publicKey) {
			if (typeof opts.publicKey !== 'string') {
				throw E.INVALID_ARGUMENT('Expected public key to be a string');
			}
			if (!opts.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
				throw new Error('Expected public key to be PEM formatted');
			}
			data.type = 'certificate';
			data.publicKey = opts.publicKey;
		} else if (opts.secret) {
			if (typeof opts.secret !== 'string') {
				throw E.INVALID_ARGUMENT('Expected secret to be a string');
			}
			data.type = 'secret';
			data.secret = opts.secret;
		} else {
			throw new Error('Expected public key or secret');
		}

		if (opts.roles) {
			data.roles = await this.sdk.role.resolve(account, opts.roles, { client: true, org: orgRef });
		}

		if (opts.teams) {
			data.teams = await this.resolveTeams(account, org, opts.teams);
		}

		const client: PlatformClient = await this.sdk.request('/api/v1/client', account, {
			errorMsg: 'Failed to create service account',
			json: data
		});

		const { teams } = await this.sdk.team.list(account, orgRef, client.guid);
		const clientTeams = [];

		for (const team of teams) {
			const user = team.users.find(u => u.guid === client.guid);
			if (user) {
				clientTeams.push({
					guid: team.guid,
					name: team.name,
					roles: user.roles
				});
			}
		}

		return {
			client: {
				client_id:   client.client_id,
				description: client.description,
				guid:        client.guid,
				method:      this.resolveType(client.type),
				name:        client.name,
				org_guid:    client.org_guid,
				teams:       clientTeams,
				type:        client.type
			} as Client,
			org: orgRef
		};
	}

	/**
	 * Finds a service account by client id.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {String} clientId - The service account's client id.
	 * @returns {Promise<Object>}
	 */
	async find(account: Account, org: OrgLike, clientId: string): Promise<{ client: Client, org: OrgRef }> {
		this.assertPlatformAccount(account);

		const { clients, org: orgRef } = await this.list(account, org);

		// first try to find the service account by guid, then client id, then name
		let clientRef: ClientRef | undefined = clients.find(c => c.guid === clientId);
		if (!clientRef) {
			clientRef = clients.find(c => c.client_id === clientId);
		}
		if (!clientRef) {
			clientRef = clients.find(c => c.name === clientId);
		}

		// if still not found, error
		if (!clientRef) {
			throw new Error(`Service account "${clientId}" not found`);
		}

		// get service account description
		const platformClient: PlatformClient = await this.sdk.request(`/api/v1/client/${clientRef.client_id}`, account, {
			errorMsg: 'Failed to get service account'
		});

		// get the teams
		const teams: ClientTeam[] = [];
		const { teams: allTeams } = await this.sdk.team.list(account, platformClient.org_guid);
		for (const team of allTeams) {
			const user = team.users.find(u => u.guid === platformClient.guid);
			if (user) {
				teams.push({
					guid:  team.guid,
					name:  team.name,
					roles: user.roles
				});
			}
		}

		return {
			client: {
				client_id:   platformClient.client_id,
				description: platformClient.description,
				guid:        platformClient.guid,
				method:      this.resolveType(platformClient.type),
				name:        platformClient.name,
				org_guid:    platformClient.org_guid,
				teams,
				type:        platformClient.type
			},
			org: orgRef
		};
	}

	/**
	 * Generates a new public/private key pair.
	 * @returns {Promise<Object>} Resolves an object with `publicKey` and `privateKey` properties.
	 */
	async generateKeyPair(): Promise<{ publicKey: string, privateKey: string }> {
		return await promisify(crypto.generateKeyPair)('rsa', {
			modulusLength: 2048,
			publicKeyEncoding: { type: 'spki', format: 'pem' },
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
		});
	}

	/**
	 * Retrieves a list of all service accounts for the given org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @returns {Promise<Object>} Resolves a list of service accounts and their org.
	 */
	async list(account: Account, org: OrgLike): Promise<{ clients: ClientRef[], org: OrgRef }> {
		const orgRef: OrgRef = this.sdk.org.resolve(account, org, true);
		const clients: PlatformClient[] = await this.sdk.request(`/api/v1/client?org_id=${orgRef.org_id}`, account, {
			errorMsg: 'Failed to get service accounts'
		});

		return {
			org: orgRef,
			clients: clients
				.map(c => ({
					client_id:  c.client_id,
					guid:       c.guid,
					method:     this.resolveType(c.type),
					name:       c.name,
					org_guid:   c.org_guid,
					team_count: c.teams,
					type:       c.type
				} as ClientRef))
				.sort((a, b) => a.name.localeCompare(b.name))
		};
	}

	/**
	 * Removes a service account.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object|String} client - The service account object or client id.
	 * @returns {Promise<Object>} Resolves the service account that was removed.
	 */
	async remove(account: Account, org: OrgLike, client: string): Promise<{ client: Client, org: OrgRef }> {
		const orgRef: OrgRef = this.sdk.org.resolve(account, org, true);

		const c: Client = await this.resolve(account, orgRef, client);
		await this.sdk.request(`/api/v1/client/${c.client_id}`, account, {
			errorMsg: 'Failed to remove service account',
			method: 'delete'
		});

		return { client: c, org: orgRef };
	}

	/**
	 * Resolves a client by name, id, org guid using the specified account.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, guid, or id.
	 * @param {Object|String} client - The service account object or client id.
	 * @returns {Promise<Object>}
	 */
	async resolve(account: Account, org: OrgLike, client: Client | string): Promise<Client> {
		if (client && typeof client === 'object' && client.client_id) {
			return client;
		}

		if (client && typeof client === 'string') {
			return (await this.find(account, org, client)).client;
		}

		throw E.INVALID_ARGUMENT('Expected client to be an object or client id');
	}

	/**
	 * Validates a list of teams for the given org.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {Array<Object>} [teams] - A list of objects containing `guid` and `roles`
	 * properties.
	 * @returns {Array<Object>} An aray of team guids.
	 */
	async resolveTeams(account: Account, org: OrgLike, teams: ClientTeam[]): Promise<ClientTeam[]> {
		if (!Array.isArray(teams)) {
			throw E.INVALID_ARGUMENT('Expected teams to be an array');
		}

		const resolvedTeams: ClientTeam[] = [];

		if (!teams.length) {
			return resolvedTeams;
		}

		const { org: orgRef, teams: availableTeams } = await this.sdk.team.list(account, org);
		const teamRoles = await this.sdk.role.list(account, { org: orgRef, team: true });
		const guids: { [guid: string]: number } = {};

		for (const team of teams) {
			if (!team || typeof team !== 'object' || !team.guid || typeof team.guid !== 'string' || !team.roles || !Array.isArray(team.roles) || !team.roles.length) {
				throw E.INVALID_ARGUMENT('Expected team to be an object containing a guid and array of roles');
			}

			// find the team by name or guid
			const lt = team.guid.toLowerCase().trim();
			const found: Team | undefined = availableTeams.find(t => t.guid === lt || t.name.toLowerCase() === lt);
			if (!found) {
				throw new Error(`Invalid team "${team.guid}"`);
			}

			// validate roles
			for (const role of team.roles) {
				if (!teamRoles.find(r => r.id === role)) {
					throw new Error(`Invalid team role "${role}"`);
				}
			}

			// dedupe
			if (guids[found.guid]) {
				continue;
			}
			guids[found.guid] = 1;

			resolvedTeams.push({
				guid:  found.guid,
				name:  found.name,
				roles: team.roles
			});
		}

		return resolvedTeams;
	}

	/**
	 * Returns the service account auth type label.
	 * @param {String} type - The auth type.
	 * @returns {String}
	 */
	resolveType(type: string): string {
		return type === 'secret' ? 'Client Secret' : type === 'certificate' ? 'Client Certificate' : 'Other';
	}

	/**
	 * Updates an existing service account's information.
	 * @param {Object} account - The account object.
	 * @param {Object|String|Number} org - The organization object, name, id, or guid.
	 * @param {Object} opts - Various options.
	 * @param {Object|String} opts.client - The service account object or client id.
	 * @param {String} [opts.desc] - The service account description.
	 * @param {String} [opts.name] - The display name.
	 * @param {String} [opts.publicKey] - A PEM formatted public key.
	 * @param {Array<String>} [opts.roles] - A list of roles to assign to the service account.
	 * @param {String} [opts.secret] - A client secret key.
	 * @param {Array<Object>} [opts.teams] - A list of objects containing `guid` and `roles`
	 * properties.
	 * @returns {Promise}
	 */
	async update(account: Account, org: OrgLike, opts: {
		client: Client | string,
		desc?: string,
		name?: string,
		publicKey?: string,
		roles?: string[],
		secret?: string,
		teams?: ClientTeam[]
	}): Promise<{ client: Client, org: OrgRef }> {
		const orgRef: OrgRef = this.sdk.org.resolve(account, org, true);

		if (!opts || typeof opts !== 'object') {
			throw E.INVALID_ARGUMENT('Expected options to be an object');
		}

		const client: Client = await this.resolve(account, orgRef, opts.client);
		const data: PlatformClientPayload = {};

		if (opts.name) {
			if (typeof opts.name !== 'string') {
				throw E.INVALID_ARGUMENT('Expected name to be a non-empty string');
			}
			data.name = opts.name;
		}

		if (opts.desc) {
			if (typeof opts.desc !== 'string') {
				throw E.INVALID_ARGUMENT('Expected description to be a string');
			}
			data.description = opts.desc;
		}

		if (opts.publicKey) {
			if (typeof opts.publicKey !== 'string') {
				throw E.INVALID_ARGUMENT('Expected public key to be a string');
			}
			if (!opts.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')) {
				throw new Error('Expected public key to be PEM formatted');
			}
			if (client.type !== 'certificate') {
				throw new Error(`Service account "${client.name}" uses auth method "${this.resolveType(client.type)}" and cannot be changed to "${this.resolveType('certificate')}"`);
			}
			data.publicKey = opts.publicKey;
		} else if (opts.secret) {
			if (typeof opts.secret !== 'string') {
				throw E.INVALID_ARGUMENT('Expected secret to be a string');
			}
			if (client.type !== 'secret') {
				throw new Error(`Service account "${client.name}" uses auth method "${this.resolveType(client.type)}" and cannot be changed to "${this.resolveType('secret')}"`);
			}
			data.secret = opts.secret;
		}

		if (opts.roles !== undefined) {
			data.roles = !opts.roles ? [] : await this.sdk.role.resolve(account, opts.roles, { client: true, org: orgRef });
		}

		if (opts.teams !== undefined) {
			data.teams = opts.teams && await this.resolveTeams(account, orgRef, opts.teams) || [];
		}

		const platformClient: PlatformClient = await this.sdk.request(`/api/v1/client/${client.guid}`, account, {
			errorMsg: 'Failed to update service account',
			json: data,
			method: 'put'
		});

		// get the teams
		const teams: ClientTeam[] = [];
		const { teams: allTeams } = await this.sdk.team.list(account, platformClient.org_guid);
		for (const team of allTeams) {
			const user = team.users.find(u => u.client_id && u.guid === platformClient.guid);
			if (user) {
				teams.push({
					guid:  team.guid,
					name:  team.name,
					roles: user.roles
				});
			}
		}

		return {
			client: {
				client_id:   platformClient.client_id,
				description: platformClient.description,
				guid:        platformClient.guid,
				method:      this.resolveType(platformClient.type),
				name:        platformClient.name,
				org_guid:    platformClient.org_guid,
				teams,
				type:        platformClient.type
			},
			org: orgRef
		};
	}
}
