export {};

// Extend NodeJS Process definition with utilised internal functions.
declare global {
    namespace NodeJS {
        interface Process {
            _getActiveHandles(): any[];
			binding(name: string): any;
        }
    }
}
