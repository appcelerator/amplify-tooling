/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import * as config from './config';
import * as locations from './locations';

export {
	config,
	locations
};
