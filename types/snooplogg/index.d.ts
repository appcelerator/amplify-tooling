declare module 'snooplogg' {
	import { Transform, Writable } from 'stream';

	class Functionator extends Function {
		constructor(fn: any);
	}
	
	class Logger extends Functionator {
		error: (s: any) => void;
		log: (s: any) => void;
		warn: (s: any) => void;

		constructor(namespace: string, parent?: Logger, root?: SnoopLogg, style?: string);
	
		get console(): Console;
	
		createStream({ fd, type }?: {
			fd: number;
			type: string;
		}): StdioDispatcher;
	
		get enabled(): boolean;
	
		get namespace(): string | null;
	}

	class SnoopLogg extends Logger {
		chalk: {
			cyan: (s?: string) => string,
			gray: (s?: string) => string,
			green: (s?: string) => string
		};

		styles: {
			alert: (s?: string | number) => string,
			bold: (s?: string | number) => string,
			cyan: (s?: string | number) => string,
			gray: (s?: string | number) => string,
			green: (s?: string | number) => string
			highlight: (s?: string | number) => string,
			note: (s?: string | number) => string,
			ok: (s?: string | number) => string,
			red: (s?: string | number) => string,
			yellow: (s?: string | number) => string,
			[key: string]: (s?: string | number) => string
		};

		constructor(opts: any);
	
		applyStyle(style: string, text: any): string;
	
		/**
		 * Allows settings to be changed.
		 *
		 * @param {Object} [opts] - Various options.
		 * @param {String|Array.<String>} [opts.colors] - An array or comma-separated list of colors to
		 * choose from when auto-styling.
		 * @param {Object} [opts.inspectOptions] - Options to pass into `util.inspect()` when
		 * stringifying objects. Set to `null` to stringify objects using Node's `util.format()`.
		 * @param {Number} [opts.maxBufferSize] - The max buffer size.
		 * @returns {SnoopLogg}
		 * @access public
		 */
		config(opts?: {}): this;
	
		/**
		 * Dispatches a message object through the middlewares, filters, and eventually to all output
		 * streams.
		 *
		 * @param {Object} msg - A message object.
		 * @param {Array} msg.args - An array of zero or more arguments that will be formatted into the
		 * final log message.
		 * @access public
		 */
		dispatch(msg: any): void;
	
		enable(pattern?: string): this;
	
		isEnabled(namespace: string): boolean;
	
		ns(namespace: string): Logger;
	
		/**
		 * Adds a stream to pipe log messages to.
		 *
		 * @param {stream.Writable} stream - The stream to pipe messages to.
		 * @param {Object} [opts] - Various options.
		 * @param {Boolean} [opts.flush=false] - When true, immediately flushes the buffer of log
		 * messages to the stream.
		 * @param {String} [opts.theme] - The theme to apply to all messages written to this stream.
		 * @returns {SnoopLogg}
		 * @access public
		 */
		pipe(stream: Writable, opts?: {}): this;
	
		snoop(nsPrefix?: string): this;
	
		get stdio(): this;
	
		/**
		 * Registers a function that applies a style to a message.
		 *
		 * @param {String} name - The name of the style.
		 * @param {Function} fn - A function to call that applies the style.
		 * @returns {SnoopLogg}
		 * @access public
		 */
		style(name: string, fn: any): this;
	
		/**
		 * Registers a function that applies a theme to a message.
		 *
		 * @param {String} name - The name of the theme.
		 * @param {Function} fn - A function to call that applies the theme.
		 * @returns {SnoopLogg}
		 * @access public
		 */
		theme(name: string, fn: any): this;
	
		/**
		 * Registers a new log type.
		 *
		 * @param {String} name - The log type name.
		 * @param {Object} [opts] - Various options.
		 * @param {String} [opts.style] - The color to associate with this type.
		 * @param {String} [opts.label] - The label to display when print this type of log message.
		 * @param {Number} [opts.fd] - The file descriptor. Use `0` for stdout and `1` for stderr.
		 * @returns {SnoopLogg}
		 * @access public
		 */
		type(name: string, opts?: {}): this;
	
		unpipe(stream: Writable): this;
	
		unsnoop(): this;
	
		/**
		 * Adds a middleware function to the message dispatching system.
		 *
		 * @param {Function} middleware - A middleware function to add to the list.
		 * @param {Number} [priority=0] - The middleware priority. Negative priority is run before
		 * positive values.
		 * @returns {SnoopLogg}
		 * @access public
		 */
		use(middleware: any, priority?: number): this;
	}

	class StripColors extends Transform {
		constructor(opts?: {});
		_transform(msg: any, enc: any, cb: any): void;
	}
	
	class Format extends Transform {
		constructor(opts?: {});
		_transform(msg: any, enc: any, cb: any): void;
	}

	class StdioStream extends Writable {
		constructor(opts?: {});
		_write(msg: any, enc: any, cb: any): void;
	}

	class StdioDispatcher extends Writable {
		constructor(logger: any, params: any);
		_write(data: any, enc: any, cb: any): void;
	}

	function createInstanceWithDefaults(): SnoopLogg;
	const instance: SnoopLogg;

	export default instance;
	export {
		createInstanceWithDefaults,
		Format,
		Logger,
		SnoopLogg,
		StdioStream,
		StripColors
	};
}
