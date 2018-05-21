/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import loadConfig from './config';
import * as locations from './locations';
import request from './request';

export {
	loadConfig,
	locations,
	request
};
