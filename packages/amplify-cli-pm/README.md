# AMPLIFY CLI Package Manager

A package manager for finding and installing components for Axway products such as API Builder,
Titanium SDK, and Appc Daemon.

## Installation

This package is bundled with the AMPLIFY CLI and thus does not need to be directly installed.

	npm i -g @axway/amplify-cli

## Quick Start

Searching for a connector:

	amplify pm search mongo --type connector

Install an API Builder connector:

	amplify pm install appc.mongo

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-pm/LICENSE
