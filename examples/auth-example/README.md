# AMPLIFY CLI Auth Example

An example of a CLI that extends the AMPLIFY CLI and incorporates authentication.

## Prerequisites

In order to get this example working you must install:

 * git
 * Node.js 8.10.0 or newer
 	* https://nodejs.org/
 * yarn
   * https://yarnpkg.com/
 * lerna
   * `npm i -g lerna`
 * AMPLIFY CLI

## Installation

	git clone https://github.com/appcelerator/amplify-tooling.git
	cd amplify-tooling
	lerna bootstrap
	gulp build
	cd examples/auth-example
	gulp build
	amplify config set extensions.auth-example `pwd`

## Usage

	amplify auth-example info
