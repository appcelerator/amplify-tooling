#!/usr/bin/env node

/**
 * Converts command output to mustache template format
 */

import fs from 'fs';

function convertToTemplate(stdout, useColor = false) {
	let template = stdout;

	if (useColor) {
		// Replace ANSI color codes with mustache color tags
		// Bold: \x1b[1m ... \x1b[22m
		template = template.replace(/\x1b\[1m(.*?)\x1b\[22m/g, '{{#bold}}$1{{/bold}}');

		// Cyan: \x1b[36m ... \x1b[39m
		template = template.replace(/\x1b\[36m(.*?)\x1b\[39m/g, '{{#cyan}}$1{{/cyan}}');

		// Yellow: \x1b[33m ... \x1b[39m
		template = template.replace(/\x1b\[33m(.*?)\x1b\[39m/g, '{{#yellow}}$1{{/yellow}}');

		// Underline (for <value>): \x1b[4m ... \x1b[24m
		template = template.replace(/\x1b\[4m(.*?)\x1b\[24m/g, '$1');
	}

	// Replace version numbers
	template = template.replace(/\b\d+\.\d+\.\d+(-[\w.]+)?\b/g, '{{version}}');

	// Replace year
	template = template.replace(/\b202[0-9]\b/g, '{{year}}');

	// Replace platform-specific strings
	template = template.replace(/darwin-arm64|linux-x64|win32-x64/g, '{{string}}');
	template = template.replace(/node-v\d+\.\d+\.\d+/g, 'node-v{{string}}');

	// Replace time/duration values
	template = template.replace(/\b\d+s\b/g, '{{delta}}');
	template = template.replace(/\b\d+m\s*\d+s\b/g, '{{delta}}');
	template = template.replace(/\b\d+h\s*\d+m\s*\d+s\b/g, '{{delta}}');

	return template;
}

// Get log file path from command line
const logFile = process.argv[2];
if (!logFile) {
	console.error('Usage: node test/helpers/generate-template-from-log.js <test/test-output-logs/log-file.json> [stdout|stderr]');
	console.error('\nGenerate log files by passing LOG_TEST_OUTPUT=1 when running tests. It\'s recommended to run limited tests with this flag to avoid generating too many logs (e.g. `LOG_TEST_OUTPUT=1 npm test -- test/commands/axway/test-axway.js`).');
	process.exit(1);
}

const stream = process.argv[3] === 'stderr' ? 'stderr' : 'stdout';

const logData = JSON.parse(fs.readFileSync(logFile, 'utf8'));

const useColor = logData.opts.color === true;
const template = convertToTemplate(logData[stream], useColor);

console.log(template);
