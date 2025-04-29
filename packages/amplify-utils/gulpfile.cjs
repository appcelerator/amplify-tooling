'use strict';

require('@axway/gulp-tasks')({
	exports,
	projectDir: './',
	pkgJson:  require('./package.json'),
	template: 'standard',
	babel:    'node12'
});
