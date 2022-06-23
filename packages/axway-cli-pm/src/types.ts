export interface ConfigExtensions {
    [name: string]: string; // path
}

export interface PackageData {
    description?: string;
    name: string;
    version?: string;
    versions: {
        [ver: string]: {
            managed: boolean;
            path: string;
        }
    }
}

export interface PackageDataDetailed {
    description?: string;
    installed?: boolean;
    name: string;
    type?: string;
    version: string;
    versions: string[];
}

export interface InstalledPackageDataDetailed extends PackageDataDetailed {
    path: string;
}

export interface PurgeablePackageData extends PackageData {
	managed: boolean;
	path: string;
	version: string;
}

export interface PurgablePackageMap {
	[name: string]: PurgeablePackageData[]
}
