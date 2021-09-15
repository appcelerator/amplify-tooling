'use strict';

require('@axway/gulp-tasks')({
	exports,
	pkgJson:  require('./package.json'),
	template: 'standard',
	babel:    'node12'
});
