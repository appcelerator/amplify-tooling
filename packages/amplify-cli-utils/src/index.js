/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import loadConfig from './config';

import * as auth from './auth';
import * as locations from './locations';

export {
	auth,
	loadConfig,
	locations
};
