import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { globSync } from 'glob';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
var external = require('@yelo/rollup-node-external');
;
export default [
    {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/amplify-cli-utils/src/**/*.js').map(file => [path.relative(
                    'packages/amplify-cli-utils/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/amplify-cli-utils/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
      {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/amplify-config/src/**/*.js').map(file => [path.relative(
                    'packages/amplify-config/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/amplify-config/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
      {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/amplify-request/src/**/*.js').map(file => [path.relative(
                    'packages/amplify-request/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/amplify-request/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
      {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/amplify-sdk/src/**/*.js').map(file => [path.relative(
                    'packages/amplify-sdk/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/amplify-sdk/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
      {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/amplify-utils/src/**/*.js').map(file => [path.relative(
                    'packages/amplify-utils/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/amplify-utils/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
      {
      external: external(),
      input: Object.fromEntries(
		globSync('packages/axway-cli/src/**/*.js').map(file => [path.relative(
				'packages/axway-cli/src',
				file.slice(0, file.length - path.extname(file).length)
			),
			fileURLToPath(new URL(file, import.meta.url))
        ])
	),
      output: [
        {
          dir: "packages/axway-cli/dist",
          format: "esm",
          sourcemap: true,
        },
      ],
      plugins: [
        resolve(),
        commonjs(),
        json(),
      ],
    },
    {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/axway-cli-auth/src/**/*.js').map(file => [path.relative(
                    'packages/axway-cli-auth/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/axway-cli-auth/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
      {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/axway-cli-oum/src/**/*.js').map(file => [path.relative(
                    'packages/axway-cli-oum/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/axway-cli-oum/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
      {
        external: external(),
        input: Object.fromEntries(
            globSync('packages/axway-cli-pm/src/**/*.js').map(file => [path.relative(
                    'packages/axway-cli-pm/src',
                    file.slice(0, file.length - path.extname(file).length)
                ),
                fileURLToPath(new URL(file, import.meta.url))
            ])
        ),
        output: [
          {
            dir: "packages/axway-cli-pm/dist",
            format: "esm",
            sourcemap: true,
          },
        ],
        plugins: [
          resolve(),
          commonjs(),
          json(),
        ],
      },
  ];