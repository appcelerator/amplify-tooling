declare module 'check-kit' {
	type PackageJsonObject = Object;

	class CheckKitOptions {
		applyOwner?: boolean;
		caFile?: string;
		certFile?: string;
		checkInterval?: number;
		cwd?: string;
		distTag?: string;
		force?: boolean;
		keyFile?: string;
		metaDir: string;
		pkg: string | PackageJsonObject;
		proxy?: string;
		registryUrl?: string;
		strictSSL?: boolean;
		timeout?: number;
	}

	class CheckKitResults {
		current: string;
		latest: string;
		name: string;
	}

	function check(opts: CheckKitOptions): Promise<CheckKitResults>;

	export default check;

	export type {
		CheckKitResults
	};
}
