declare module 'cli-kit' {
	import tty from 'tty';

	class CLI extends CLIContext {
		constructor(opts: CLIOptions);
		exec(): Promise<CLIState>;
		on(event: string, handler: (ctx: CLIState, next: CLINextIterator) => Promise<void>): Promise<this>;
	}

	class CLIArgument {
		redact?: boolean;
	}

	class CLIArgv {
		[key: string]: string | number | boolean;
	}

	class CLICommand {
		name: string;
		prop: (key: string) => string | boolean;
		skipExtensionUpdateCheck?: boolean; // this is an ad-hoc Axway CLI specific property
	}

	class CLIContext {
		desc?: string;
		emitAction(event: string, payload: any): Promise<void>;
		name: string;
		[key: string]: any;
	}

	class CLIError extends Error {
		showHelp: boolean;
	}

	class CLIHelpConfig {
		footer: (this: CLIContext, helpOpts?: CLIHelpOptions) => Promise<string> | string;
		header: (this: CLIContext, helpOpts?: CLIHelpOptions) => Promise<string> | string;
	}

	class CLIHelpOptions {
		style: {
			alert: (s?: string | number) => string,
			bold: (s?: string | number) => string,
			cyan: (s?: string | number) => string,
			gray: (s?: string | number) => string,
			green: (s?: string | number) => string
			heading: (s?: string | number) => string,
			highlight: (s?: string | number) => string,
			magenta: (s?: string | number) => string,
			note: (s?: string | number) => string,
			ok: (s?: string | number) => string,
			red: (s?: string | number) => string,
			yellow: (s?: string | number) => string
		}
	}

	type CLINextIterator = () => Promise<any>;

	class CLIOption {
		hidden?: boolean;
		isFlag?: boolean;
		redact?: boolean;
	}

	class CLIOptions {
		banner: () => string;
		commands: string;
		desc: string;
		extensions: string[];
		help: CLIHelpConfig | boolean;
		helpExitCode: number;
		helpTemplateFile: string;
		name: string;
		options: CLIOptionsMap;
		version: string;
	}

	class CLIOptionsMap {
		[key: string]: CLIOption;
	}

	class CLIOptionCallbackState {
		ctx: CLIContext;
		data: any;
		exitCode: () => number;
		input: string[];
		name: string;
		next: CLINextIterator;
		opts: CLIOptionsMap;
		option: CLIOption;
		parser: CLIParser;
		value: string | number | boolean | undefined;
	}

	class CLIParser {
		//
	}

	class CLIParsedArgument {
		arg: CLIArgument;
		input: string[];
		option: CLIOption;
		type: string;
	}

	class CLIState {
		__argv: CLIParsedArgument[];
		argv: CLIArgv;
		cli: CLI;
		cmd: CLICommand;
		console: Console;
		contexts: CLIContext[];
		ctx: CLIContext;
		err?: Error;
		exitCode: () => number;
		setExitCode: (code: number) => number;
		terminal: CLITerminal;
		warnings: string[];
	}

	class CLITerminal {
		stdout: tty.WriteStream;
		stderr: tty.WriteStream;
		once(event: string, handler: (...args: any) => void): this;
	}

	const ansi: {
		bel: string,
		clear: string,
		cursor: {
			show:    string,
			hide:    string,
			save:    string,
			restore: string,
			get:     string,
			home:    string,
			left:    string,

			down(n: number): string,
			up(n: number): string,

			backward(n: number): string,
			forward(n: number): string,

			move(dx: number, dy: number): string,
			to(x: number, y: number): string,

			position: string,

			next(n: number): string,
			prev(n: number): string
		},
		custom: {
			echo(enabled: boolean): string,
			exec(command: string): string,
			exit(code: number): string,
			keypress(key: string): string
		},
		erase: {
			down:    string,
			line:    string,
			lines(count: number): string,
			screen:  string,
			toEnd:   string,
			toStart: string,
			up:      string
		},
		scroll: {
			down: string,
			up: string
		},
		link(text: string, url: string): string,
		split(str: string): string[],
		strip(str: string): string,
		toLowerCase(str: string): string,
		toUpperCase(str: string): string,
		trim(str: string): string,
		trimStart(str: string): string,
		trimEnd(str: string): string
	};

	export default CLI;
	export {
		ansi,
		CLI
	};

	export type {
		CLIContext,
		CLIError,
		CLIHelpOptions,
		CLINextIterator,
		CLIOptionCallbackState,
		CLIParsedArgument,
		CLIState
	};
}
