# Axway Package Manager CLI

A package manager for finding and installing components for Axway products such as API Builder,
Titanium SDK, and Appc Daemon.

## Installation

This package is bundled with the Axway CLI and thus does not need to be directly installed.

	npm i -g axway

## Quick Start

Find first 50 packages:

	axway pm search

Find only 10 packages:

	axway pm search --limit 10

Searching for packages by keyword:

	axway pm search acs

Searching for packages by type:

	axway pm search --type central-cli-plugin

## Legal

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/amplify-tooling/blob/master/packages/amplify-cli-pm/LICENSE
