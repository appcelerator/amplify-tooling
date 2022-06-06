import Base from './base.js';
import E from '../errors.js';
import snooplogg from 'snooplogg';
import { Account, ActivityParams, ActivityResult, User, UserChanges, UserInfo } from '../types.js';
import { PlatformUser } from './platform-types.js';

const { log } = snooplogg('amplify-sdk:auth');

export default class AmplifySDKUser extends Base {
	/**
	 * Retrieves an account's user's activity.
	 * @param {Object} account - The account object.
	 * @param {Object} [params] - Various parameters.
	 * @param {String} [params.from] - The start date in ISO format.
	 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and
	 * `from`. If `true`, uses current month.
	 * @param {String} [params.to] - The end date in ISO format.
	 * @returns {Promise<Object>}
	 */
	async activity(account: Account, params?: {
		from?: string,
		month?: string | boolean,
		to?: string
	}): Promise<ActivityResult> {
		return await this.sdk.activity.find(account, {
			...params,
			userGuid: account.user.guid
		} as ActivityParams);
	}

	/**
	 * Retrieves a user's information.
	 * @param {Object} account - The account object.
	 * @param {String} user - The user email or guid.
	 * @returns {Promise<Object>}
	 */
	async find(account: Account, user: User | string): Promise<User> {
		if (typeof user === 'object' && user.guid) {
			return user;
		}

		const subject: string = user as string;
		const platformUser: PlatformUser = await this.sdk.request(`/api/v1/user/${subject}`, account, {
			errorMsg: 'Failed to find user'
		});

		return {
			dateJoined: platformUser.date_activated,
			email:      platformUser.email,
			firstname:  platformUser.firstname,
			guid:       platformUser.guid,
			lastname:   platformUser.lastname
		};
	}

	/**
	 * Updates an account's user's information.
	 * @param {Object} account - The account object.
	 * @param {Object} [info] - Various user fields.
	 * @param {String} [info.firstname] - The user's first name.
	 * @param {String} [info.lastname] - The user's last name.
	 * @returns {Promise<Object>}
	 */
	 async update(account: Account, info: UserInfo = {}): Promise<{
		 changes: UserChanges,
		 user: User | null
	 }> {
		this.assertPlatformAccount(account);

		if (!info || typeof info !== 'object') {
			throw E.INVALID_ARGUMENT('Expected user info to be an object');
		}

		let user: User | null = account.user;
		const changes: UserChanges = {};
		const json: UserInfo = {
			firstname: info.firstname ? String(info.firstname).trim() : undefined,
			lastname:  info.lastname  ? String(info.lastname).trim() : undefined
		};

		// remove unchanged
		for (const key of Object.keys(json)) {
			if (json[key as keyof UserInfo] === user[key as keyof UserInfo]) {
				delete json[key as keyof UserInfo];
			} else {
				changes[key] = {
					v: json[key as keyof UserInfo],
					p: user[key as keyof UserInfo]
				};
			}
		}

		if (Object.keys(json).length) {
			await this.sdk.request(`/api/v1/user/profile/${user.guid}`, account, {
				errorMsg: 'Failed to update user information',
				json,
				method: 'put'
			});

			log('Refreshing account information...');
			const acct: Account | null = await this.sdk.auth.loadSession(account);
			user = acct?.user || null;
		}

		return {
			changes,
			user
		};
	}
}
