/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import loadConfig from '@axway/amplify-config';

import * as auth from './auth';
import * as environments from './environments';
import * as locations from './locations';

export { buildParams } from './auth';

export {
	auth,
	environments,
	loadConfig,
	locations
};
