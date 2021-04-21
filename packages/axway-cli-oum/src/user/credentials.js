export default {
	desc: 'Change your login credentials',
	async action({ console }) {
		const { initSDK, isHeadless } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const { sdk } = initSDK();
		const open = require('open');

		if (isHeadless()) {
			throw new Error('Changing your login credentials requires a web browser and is unsupported in headless environments');
		}

		const url = `${sdk.platformUrl}#/user/credentials`;
		console.log(`Opening web browser to ${highlight(url)}`);
		await open(url);
	}
};
