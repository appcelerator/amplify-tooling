interface ConfigOptions {
	data?: {},
	file?: string
}

declare class Config {
	static Base: string;

	init(opts: ConfigOptions): Promise<Config>;

	data(key: string): any;

	get(key: string): any;
}

declare module 'config-kit' {
	export = Config;
}