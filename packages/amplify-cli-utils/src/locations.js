import path from 'path';
import os from 'os';

// Folders
export const axwayDir = process.env.MOCK_AXWAY_HOME || path.join(os.homedir(), '.axway');

// Files
export const configFile = path.join(axwayDir, 'amplify-cli.json');
