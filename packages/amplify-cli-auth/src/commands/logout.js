import { auth } from '@axway/amplify-cli-utils';

export default {
	desc: 'log out of the AMPLIFY platform',
	async action({ argv }) {
		try {
			await auth.logout({
				baseUrl:  argv.baseUrl,
				clientId: argv.clientId,
				env:      argv.env,
				realm:    argv.realm
			});
			console.log('Logged out successfully');
		} catch (e) {
			console.error(`Logout failed: ${e.message}`);
		}
	}
};
