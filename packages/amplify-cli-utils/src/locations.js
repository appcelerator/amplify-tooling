import os from 'os';
import path from 'path';

// Directories
export const axwayHome = path.join(os.homedir(), '.axway');

// Files
export const configFile = path.join(axwayHome, 'axway-cli', 'config.json');
