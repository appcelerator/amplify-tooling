import { initSDK, isHeadless } from '../../lib/utils.js';
import snooplogg from 'snooplogg';
import pkg from 'open';

export default {
	desc: 'Opens a web browser to the change your password page',
	async action({ console }) {
		const { highlight } = snooplogg.styles;
		const { sdk } = await initSDK();
		const open = pkg;

		if (isHeadless()) {
			throw new Error('Changing your login credentials requires a web browser and is unsupported in headless environments');
		}
		if (sdk !== null) {
			const url = `${sdk.platformUrl}#/user/credentials`;
			console.log(`Opening web browser to ${highlight(url)}`);
			await open(url);
		}

	}
};
