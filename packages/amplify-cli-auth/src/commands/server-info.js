export default {
	hidden: true,
	name: 'server-info',
	async action({ argv, console }) {
		const [
			{ APS },
			{ buildParams }
		] = await Promise.all([
			import('@axway/amplify-platform-sdk'),
			import('@axway/amplify-cli-utils')
		]);

		const params = buildParams({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		});

		const info = await new APS(params).auth.serverInfo();
		console.log(JSON.stringify(info, null, '  '));
	}
};
