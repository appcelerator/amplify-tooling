import {
	AxwayCLIState
} from '@axway/amplify-cli-utils';

export default {
	hidden: true,
	name: 'server-info',
	async action({ argv, console }: AxwayCLIState): Promise<void> {
		const { initSDK } = await import('@axway/amplify-cli-utils');
		const { sdk } = await initSDK({
			baseUrl:  argv.baseUrl as string,
			env:      argv.env as string,
			realm:    argv.realm as string
		});

		const info = await sdk.auth.serverInfo();
		console.log(JSON.stringify(info, null, 2));
	}
};
