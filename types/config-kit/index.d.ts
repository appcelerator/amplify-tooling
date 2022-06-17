interface ConfigOptions {
	data?: {},
	file?: string
}

declare class Config {
	static Base: string;

	data(key: string): any;
	delete(key: string, id?: string | Symbol): boolean;
	get(key?: string, defaultValue?: any): any;
	init(opts?: ConfigOptions): Promise<this>;
	pop(key: string, id?: string): Promise<any>;
	push(key: string, value: any, id?: string | Symbol): Promise<void>;
	set(key: string, value: any, id?: string | Symbol): Promise<this>;
	shift(key: string, id?: string | Symbol): Promise<any>;
	save(): Promise<this>;
	unshift(key: string, value: any, id?: string | Symbol): Promise<void>;
}

declare module 'config-kit' {
	export = Config;
}
