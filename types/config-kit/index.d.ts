interface ConfigOptions {
	data?: {},
	file?: string
}

declare class Config {
	static Base: string;

	init(opts?: ConfigOptions): Promise<Config>;

	data(key: string): any;

	get(key: string, defaultValue?: any): any;

	set(key: string, value: any, id?: string | Symbol): Promise<Config>;

	save(): Promise<Config>;
}

declare module 'config-kit' {
	export = Config;
}
