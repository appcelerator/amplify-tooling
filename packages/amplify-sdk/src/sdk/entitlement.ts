import Base from './base.js';
import { Account, Entitlement } from '../types.js';
import { PlatformEntitlement } from './platform-types.js';

export default class AmplifySDKEntitlement extends Base {
    /**
     * Retrieves entitlement information for a specific entitlement metric.
     * @param {Object} account - The account object.
     * @param {String} metric - The entitlement metric name.
     * @returns {Promise<Object>}
     */
    async find(account: Account, metric: string): Promise<Entitlement> {
        const entitlement: PlatformEntitlement = await this.sdk.request(`/api/v1/entitlement/${metric}`, account, {
            errorMsg: 'Failed to get entitlement info'
        });
        return entitlement;
    }
}
