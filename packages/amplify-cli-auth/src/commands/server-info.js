export default {
	hidden: true,
	async action({ argv, console }) {
		const { Auth } = await import('@axway/amplify-auth-sdk');
		const { auth } = await import('@axway/amplify-cli-utils');

		const params = auth.buildParams({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		});

		const client = new Auth();
		const info = await client.serverInfo(params);
		console.log(JSON.stringify(info, null, '  '));
	}
};
