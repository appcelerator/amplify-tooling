# Axway CLI Auth Example

An example of a CLI that extends the Axway CLI and incorporates authentication.

## Prerequisites

In order to get this example working you must install:

 * git
 * Node.js LTS (currently 14.x) (min >=10.19.0)
 	* https://nodejs.org/
 * yarn
   * https://yarnpkg.com/
 * lerna
   * `npm i -g lerna`
 * Axway CLI
   * `npm i -g axway`

## Installation

	git clone https://github.com/appcelerator/amplify-tooling.git
	cd amplify-tooling
	lerna bootstrap
	gulp build
	cd examples/auth-example
	gulp build
	axway config set extensions.auth-example `pwd`

## Usage

	axway auth-example info
