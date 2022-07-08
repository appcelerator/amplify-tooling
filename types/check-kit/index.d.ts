declare module 'check-kit' {
	class RequestTimeout {
		request: number;
	}

	class CheckKitOptions {
		applyOwner?: boolean;
		caFile?: Buffer | string;
		certFile?: Buffer | string;
		checkInterval?: number;
		cwd?: string;
		distTag?: string;
		force?: boolean;
		keyFile?: string;
		metaDir: string;
		pkg: string | any;
		proxy?: string;
		registryUrl?: string;
		strictSSL?: boolean;
		timeout?: RequestTimeout | number;
	}

	class CheckKitResults {
		current: string;
		latest: string;
		name: string;
		updateAvailable: boolean;
	}

	function check(opts: CheckKitOptions): Promise<CheckKitResults>;

	export default check;

	export type {
		CheckKitOptions,
		CheckKitResults
	};
}
