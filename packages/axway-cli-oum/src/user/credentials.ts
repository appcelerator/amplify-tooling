export default {
	desc: 'Opens a web browser to the change your password page',
	async action({ console }) {
		const { initSDK, isHeadless } = await import('@axway/amplify-cli-utils');
		const { default: snooplogg }  = await import('snooplogg');
		const { highlight }           = snooplogg.styles;
		const { sdk }                 = await initSDK();
		const { default: open }       = await import('open');

		if (isHeadless()) {
			throw new Error('Changing your login credentials requires a web browser and is unsupported in headless environments');
		}

		const url = `${sdk.platformUrl}#/user/credentials`;
		console.log(`Opening web browser to ${highlight(url)}`);
		await open(url);
	}
};
