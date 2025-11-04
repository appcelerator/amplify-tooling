import axwayRecommended from 'eslint-config-axway/env-node.js';
import axwayChai from 'eslint-config-axway/+chai.js';
import axwayMocha from 'eslint-config-axway/+mocha.js';
import axwayTypescript from 'eslint-config-axway/+typescript.js';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		files: [ './src/**/*.ts' ],
		extends: [
			axwayRecommended,
			axwayTypescript
		],
		rules: {
			// TODO: Remove this rule suppression when we also disable it in the tsconfig.json
			'@typescript-eslint/no-explicit-any': 'off',

			'func-style': [ 'error', 'declaration', {
				allowArrowFunctions: true,
				allowTypeAnnotation: true
			} ],
			'security/detect-non-literal-regexp': 'off'
		}
	},
	{
		files: [ './test/**/*.js' ],
		extends: [
			axwayRecommended,
			axwayMocha,
			axwayChai
		],
		rules: {
			'no-control-regex': 'off',
			'no-unused-expressions': 'off'
		}
	}
]);
