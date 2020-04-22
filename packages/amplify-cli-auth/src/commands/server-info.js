export default {
	hidden: true,
	name: 'server-info',
	async action({ argv, console }) {
		const [
			{ AmplifySDK },
			{ buildParams }
		] = await Promise.all([
			import('@axway/amplify-sdk'),
			import('@axway/amplify-cli-utils')
		]);

		const params = buildParams({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		});

		const info = await new AmplifySDK(params).auth.serverInfo();
		console.log(JSON.stringify(info, null, '  '));
	}
};
