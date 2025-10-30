#!/usr/bin/env -S node --enable-source-maps
import { enableCompileCache } from 'module';
enableCompileCache();

import { execute, settings } from '@oclif/core';
settings.performanceEnabled = true;
await execute({ dir: import.meta.url });
