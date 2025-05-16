export default {
	hidden: true,
	name: 'server-info',
	async action({ argv, console }) {
		const { initSDK } = await import('@axway/amplify-cli-utils');
		const { sdk } = await initSDK({
			baseUrl:  argv.baseUrl,
			env:      argv.env,
			realm:    argv.realm
		});

		const info = await sdk.auth.serverInfo();
		console.log(JSON.stringify(info, null, 2));
	}
};
