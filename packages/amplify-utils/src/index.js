import sourceMapSupport from 'source-map-support';
/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	sourceMapSupport.install();
}

export * from './fs.js';
export * from './path.js';
export * from './util.js';

