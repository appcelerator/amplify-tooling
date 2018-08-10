import { auth } from '@axway/amplify-cli-utils';

export default {
	hidden: true,
	async action({ argv, console }) {
		const params = auth.buildParams({
			baseUrl:  argv.baseUrl,
			clientId: argv.clientId,
			env:      argv.env,
			realm:    argv.realm
		});

		const info = await auth.serverInfo(params);
		console.log(JSON.stringify(info, null, '  '));
	}
};
