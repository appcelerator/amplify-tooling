#!/usr/bin/env -S node --enable-source-maps --loader ts-node/esm --disable-warning=ExperimentalWarning

import { execute, settings } from '@oclif/core';
settings.performanceEnabled = true;
await execute({ development: true, dir: import.meta.url });
