# AMPLIFY Tooling

This monorepo contains the AMPLIFY CLI, authentication CLI, and package manager CLI, as well as other related packages.

## Development

You'll need to install [Yarn](https://yarnpkg.com/en/docs/install) and [Node.js](https://nodejs.org/en/).

Firstly install all dependencies by running `yarn`, this will also build the packages. 

:bulb: These instructions use [npx](https://medium.com/@maybekatz/introducing-npx-an-npm-package-runner-55f7d4bd282b), but you can use [yarn run](https://yarnpkg.com/en/docs/cli/run#toc-yarn-run-script) if you prefer

If you wish to build the packages again then you can run `npx gulp build` to build the packages, you can also build an individual package you can cd into the package folder and run the same command.

To link the AMPLIFY CLI binary for use cd into `packages/amplify-cli` and run `yarn link`.

If you're doing more than just simple development on AMPLIFY CLI, you may wish to run `npx gulp watch` in the top level, this will start the gulp process in watch mode, and rebuild a package automatically when any changes occur in the source files.

## Testing

To run the tests for all packages you can run `npx gulp test`, to run with coverage run `npx gulp coverage`

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/LICENSE
