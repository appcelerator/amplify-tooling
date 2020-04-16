/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import environments from './environments';
import loadConfig from '@axway/amplify-config';

import * as auth from './auth';
import * as locations from './locations';

export { buildParams } from './auth';

export {
	auth,
	environments,
	loadConfig,
	locations
};
