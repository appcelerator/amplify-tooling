import os from 'os';
import path from 'path';

// Directories
export const axwayHome: string = path.join(os.homedir(), '.axway');

// Files
export const configFile: string = path.join(axwayHome, 'axway-cli', 'config.json');
