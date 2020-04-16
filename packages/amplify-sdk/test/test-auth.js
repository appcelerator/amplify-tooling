import SDK from './dist/index';

describe('auth', () => {
	it('should login', async () => {
		const sdk = new SDK();

		console.log(await sdk.auth.list());

		const account = await sdk.auth.login();
		console.log(account);
	});
});
