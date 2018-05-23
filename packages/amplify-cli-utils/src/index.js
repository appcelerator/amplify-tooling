/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import loadConfig from './config';
import * as locations from './locations';

export {
	loadConfig,
	locations
};
