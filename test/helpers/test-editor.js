#!/usr/bin/env node
// Cross-platform test editor: appends a harmless comment so the edit command
// detects a file change (isUpdated = true). Called by the CLI as: node test-editor.js <tmpfile>
import { appendFileSync } from 'fs';
appendFileSync(process.argv[2], '\n# edited in test\n');
