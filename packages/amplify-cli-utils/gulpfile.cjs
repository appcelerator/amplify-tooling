'use strict';

require('@axway/gulp-tasks')({
	projectDir: './',
	exports,
	pkgJson:  require('./package.json'),
	template: 'standard',
	babel:    'node12'
});
