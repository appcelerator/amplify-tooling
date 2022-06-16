declare module 'cli-kit' {
    class CLI {}

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
}
