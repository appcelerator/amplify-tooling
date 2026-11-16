'use strict';

// Plain CommonJS with no dependencies so it parses and runs on any Node version.
const required = require('../package.json').engines.node.replace(/^[^\d]*/, '');
const current = process.versions.node;

function atLeast(a, b) {
	const x = a.split('.').map(Number);
	const y = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if ((x[i] || 0) !== (y[i] || 0)) {
			return (x[i] || 0) > (y[i] || 0);
		}
	}
	return true;
}

if (!atLeast(current, required)) {
	console.error(`Axway CLI requires Node.js >=${required}, but found v${current}.\nPlease upgrade Node.js and try again.`);
	process.exit(1);
}
