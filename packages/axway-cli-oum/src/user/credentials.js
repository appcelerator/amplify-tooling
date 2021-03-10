export default {
	desc: 'Change your log in credentials',
	async action({ argv, console }) {
		const { initSDK } = require('@axway/amplify-cli-utils');
		const { default: snooplogg } = require('snooplogg');
		const { highlight } = snooplogg.styles;
		const { sdk } = initSDK();
		const open = require('open');

		const url = `${sdk.platformUrl}#/user/credentials`;
		console.log(`Opening web browser to ${highlight(url)}`);
		await open(url);
	}
};
