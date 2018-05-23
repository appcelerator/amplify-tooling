import path from 'path';
import os from 'os';

// Directories
export const axwayHome = path.join(os.homedir(), '.axway');

// Files
export const configFile = path.join(axwayHome, 'amplify-cli.json');
