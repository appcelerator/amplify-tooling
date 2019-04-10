export default {
	hidden: true,
	name: 'server-info',
	async action({ argv, console }) {
		const { auth, loadConfig } = await import('@axway/amplify-cli-utils');
		const config = loadConfig();

		const params = auth.buildParams({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		}, config);

		const client = auth.createAuth(params);
		const info = await client.serverInfo(params);
		console.log(JSON.stringify(info, null, '  '));
	}
};
