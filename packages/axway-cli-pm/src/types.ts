export interface ConfigExtensions {
    [name: string]: string; // path
}

export interface PackageData {
    description?: string;
    installed?: boolean;
    name: string;
    type?: string;
    version?: string;
    versions: {
        [ver: string]: {
            managed: boolean;
            path: string;
        }
    }
}
