interface Snooplogg {
    log: (s: string) => void;
}
    
declare function snooplogg(ns: string): Snooplogg;

declare namespace snooplogg {
    var styles: {
        alert(s: any): void;
        highlight(s: any): void;
        magenta(s: any): void;
        note(s: any): void;
        ok(s: any): void;
    };
}

declare module 'snooplogg' {
    export = snooplogg;
}
