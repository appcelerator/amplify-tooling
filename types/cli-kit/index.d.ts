declare module 'cli-kit' {
	class CLICommand {
		name: string;
		prop: (key: string) => string | boolean;
		skipExtensionUpdateCheck?: boolean; // this is an ad-hoc Axway CLI specific property
	}

	type CLINextIterator = () => Promise<any>;

	class CLIArgument {
		redact?: boolean;
	}

	class CLIOption {
		hidden?: boolean;
		isFlag?: boolean;
		redact?: boolean;
	}

	class CLIOptionsMap {
		[key: string]: CLIOption;
	}

	class CLIArgv {
		[key: string]: string | number | boolean;
	}

	class CLIContext {
		name: string;
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
		cmd: CLICommand;
		console: Console;
		contexts: CLIContext[];
		err?: Error;
		exitCode: () => number;
		startTime: number;
		warnings: string[];
	}

	class CLIOptions {
		banner: () => string;
		commands: string;
		desc: string;
		extensions: string[];
		help: boolean;
		helpExitCode: number;
		helpTemplateFile: string;
		name: string;
		options: CLIOptionsMap;
		version: string;
	}

	class CLI {
		constructor(opts: CLIOptions);
		exec(): Promise<CLIState>;
		on(event: string, handler: (ctx: CLIState, next: CLINextIterator) => Promise<void>): Promise<this>;
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
		ansi
	};

	export type {
		CLINextIterator,
		CLIParsedArgument,
		CLIState
	};
}
