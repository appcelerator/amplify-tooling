import Base from './base.js';
import { Account, ActivityParams, ActivityResult } from '../types.js';
import { PlatformActivityEvent } from './platform-types.js';
import { resolveDateRange, resolveMonthRange } from '../util.js';

export default class AmplifySDKActivity extends Base {
	/**
	 * Retrieves activity for an organization or user.
	 * @param {Object} account - The account object.
	 * @param {Object} [params] - Various parameters.
	 * @param {String} [params.from] - The start date in ISO format.
	 * @param {String|Boolean} [params.month] - A month date range. Overrides `to` and `from`.
	 * If `true`, uses current month.
	 * @param {Object|String|Number} [params.org] - The organization object, name, guid, or id.
	 * @param {String} [params.to] - The end date in ISO format.
	 * @param {String} [params.userGuid] - The user guid.
	 * @returns {Promise<Object>}
	 */
	async find(account: Account, params: ActivityParams = {}): Promise<ActivityResult> {
		this.assertPlatformAccount(account);

		if (params.month !== undefined) {
			Object.assign(params, resolveMonthRange(params.month));
		}

		let { from, to } = resolveDateRange(params.from, params.to);
		let url = '/api/v1/activity?data=true';

		if (params.org) {
			const { org_id } = this.sdk.org.resolve(account, params.org, true);
			url += `&org_id=${org_id}`;
		}

		if (params.userGuid) {
			url += `&user_guid=${params.userGuid}`;
		}

		if (from) {
			url += `&from=${from.toISOString()}`;
		}

		if (to) {
			url += `&to=${to.toISOString()}`;
		}

		const events: PlatformActivityEvent[] = await this.sdk.request(url, account, {
			errorMsg: 'Failed to get user activity'
		});

		return {
			from,
			to,
			events
		};
	};
}