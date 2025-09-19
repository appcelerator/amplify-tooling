import axwayRecommended from 'eslint-config-axway/env-node.js';
import axwayTS from 'eslint-config-axway/+typescript.js';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		files: [ './src/**/*.ts' ],
		extends: [
			axwayRecommended,
			axwayTS
		],
		rules: {
			// TODO: Remove this rule suppression when we also disable it in the tsconfig.json
			"@typescript-eslint/no-explicit-any": 'off'
		}
	}
]);