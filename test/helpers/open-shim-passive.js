/**
 * This is a shim for the `open` package which would open the web browser, but since we don't want
 * a bunch of browser tabs to be opened and we want to support CI environments, we shim `open` and
 * fake the browser interaction.
 */

const got = require('got');
const Module = require('module');

const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
	return request === 'open' ? __filename : origResolveFilename(request, parent, isMain, options);
};

// this is the passive version which will not simulate the browser being opened
module.exports = async () => {};
