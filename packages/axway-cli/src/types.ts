import {
	CLIContext,
	CLIOptionCallbackState,
	CLIState
} from 'cli-kit';

export interface AxwayCLIContext extends CLIContext {
	jsonMode: boolean;
}

export interface AxwayCLIOptionCallbackState extends CLIOptionCallbackState {
	ctx: AxwayCLIContext;
}

export interface AxwayCLIState extends CLIState {
	startTime: number;
}
