import { initSDK } from '../../lib/utils.js';
import snooplogg from 'snooplogg';

export default {
	desc: 'Provides a link to the platform account credentials page',
	async action({ console }) {
		const { highlight } = snooplogg.styles;
		const { sdk } = await initSDK();

		const url = `${sdk.platformUrl}user/credentials`;
		console.log(`Open a web browser to the following URL to manage user credentials: ${highlight(url)}`);

	}
};
