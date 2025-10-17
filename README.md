# Axway CLI

[![Build](https://github.com/appcelerator/amplify-tooling/actions/workflows/build.yml/badge.svg)](https://github.com/appcelerator/amplify-tooling/actions/workflows/build.yml)

The Axway CLI is the unified CLI for the Axway Amplify platform.

## Prerequisites

The Axway CLI requires [Node.js][1] 20.18.2 or newer.

## Installation

```console
npm install -g axway
```

### macOS and Linux Users

Due to file permissions, when installing the Axway CLI globally, you may need to prefix the
command above with `sudo`:

```console
sudo npm install -g axway
```

## Quick Start

Show all available commands:

```console
axway
```

Log into the Axway Amplify platform:

```console
axway auth login
```

List config settings:

```console
axway config ls
```

Set a config setting:

```console
axway config set <name> <value>
```

## Config Settings


| Name | Type | Default | Description |
|------|------|---------|-------------|
| `auth.clientId` | string | `"amplify-cli"` | The global client ID to use when authenticating. You can be logged into multiple different client IDs at the same time. |
| `auth.tokenRefreshThreshold` | number | `0` | The number of seconds before the access token expires and should be refreshed. As long as the refresh token is not expired, a new access token can be retrieved. This setting is only useful if the access token is still valid, but almost expired and you need a valid access token for an operation in the near future. Must be a non-negative integer. |
| `auth.tokenStoreType` | string | `"auto"` | The type of store to persist the access token after authenticating.<br>Allowed values:<br>- `"auto"` : Attempts to use the `"secure"` store, but falls back to `"file"` if secure store is unavailable.<br>- `"secure"` : Encrypts the access token and using a generated key which is stored in the system's keychain.<br>- `"file"` : Encrypts the access token using the embedded key.<br>- `"memory"` : Stores the access token in memory instead of on disk. The access tokens are lost when the process exits. This is intended for testing purposes only.<br>- `"null"` : Disables all forms of token persistence and simply returns the access token. Subsequent calls to login in the same process will force the authentication flow. This is intended for migration scripts and testing purposes only. |
| `network.caFile` | string |  | The path to a PEM formatted certificate authority bundle used to validate untrusted SSL certificates. |
| `network.proxy` | string |  | The URL of the proxy server. This proxy server URL is used for both HTTP and HTTPS requests.<br>Note: If the proxy server uses a self signed certifcate, you must specify the `network.caFile`, set `network.strictSSL` to `false`, or set the environment variable `NODE_TLS_REJECT_UNAUTHORIZED=0`. |
| `network.strictSSL` | bool | `true` | Enforces valid TLS certificates on all outbound HTTPS requests. Set this to `false` if you are behind a proxy server with a self signed certificate. |
| `update.check` | bool | `true` | Enables automatic Axway CLI and package update checks. |

## Update Checks

The Axway CLI checks for package updates for the Axway CLI and all installed CLI extensions every
hour. If there are any available updates, a message is displayed once per hour. The update checks
can be disabled by running: `axway config set update.check false`.

## Telemetry

The Axway CLI has a telemetry system that collects anonymous data which is used to improve Axway
products. We use this data to determine product roadmaps, feature deprecations, and crash
reporting.

Data collected includes your operating system, CPU architecture, Node.js version, Axway CLI
version, command invoked, and randomly generated machine and session ids.
Sensitive information including your username, email address, and paths are redacted.

Axway does __not__ collect your personal information, link your activity to your Axway account,
capture environment variables, or unique machine identifiers such as the MAC address or serial
number.

Telemetry is __disabled__ by default. You can enable telemetry by running
`axway telemetry --enable` or disable it by running `axway telemetry --disable`.

Telemetry is always disabled if the environment variable `AXWAY_TELEMETRY_DISABLED=1` is set or
when running from a well known continuous integration environment.

## Legal

This project is open source under the [Apache Public License v2][2] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][2] file included
in this distribution for more information.

[1]: https://nodejs.org/
[2]: https://github.com/appcelerator/amplify-tooling/blob/master/LICENSE
