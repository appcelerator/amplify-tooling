import { auth, loadConfig } from '@axway/amplify-cli-utils';

export default {
	aliases: [ 'revoke' ],
	args: [
		{
			name: 'accounts...',
			desc: 'one or more specific accounts to revoke credentials'
		}
	],
	desc: 'log out of the AMPLIFY platform',
	async action({ argv, console }) {
		const config = loadConfig();

		const params = auth.buildParams({
			baseUrl:      argv.baseUrl,
			clientId:     argv.clientId,
			clientSecret: argv.secret,
			env:          argv.env,
			realm:        argv.realm,
			secretFile:   argv.secretFile
		}, config);

		const revoked = await auth.revoke(params, argv.accounts);

		if (revoked.length) {
			console.log('Revoked authenticated accounts:');
			for (const account of revoked) {
				console.log(` * ${account}`);
			}
		} else {
			console.log('No accounts to revoke');
		}
	}
};
