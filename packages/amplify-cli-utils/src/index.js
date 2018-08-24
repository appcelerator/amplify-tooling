/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import environments from './environments';
import loadConfig from './config';
import request from './request';

import * as auth from './auth';
import * as locations from './locations';

export {
	auth,
	environments,
	loadConfig,
	locations,
	request
};
