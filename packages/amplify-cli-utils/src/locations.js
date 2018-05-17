import path from 'path';
import os from 'os';

// Folders
export const axwayDir = path.join(os.homedir(), '.axway');

// Files
export const configFile = path.join(axwayDir, 'amplify-cli.json');
