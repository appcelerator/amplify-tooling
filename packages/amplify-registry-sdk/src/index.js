/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Registry from './registry';

import { fetchAndInstall } from './installers';

import * as common from './common';

export {
	common,
	Registry,
	fetchAndInstall
};

export default Registry;
