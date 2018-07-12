import Auth from '@axway/amplify-auth-sdk';

import { loadConfig } from '@axway/amplify-cli-utils';

export default {
	desc: 'authenticate log in to the platform',
	async action({ argv }) {
		console.log(argv);
		console.log();

		const config = loadConfig();
		console.log(config);

		// const auth = new Auth({
		// });
	}
};
