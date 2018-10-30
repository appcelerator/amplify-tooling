import { getAccount } from '../dist/auth';
import { MemoryStore } from '@axway/amplify-auth-sdk';

describe('auth', () => {
	it('should find an access token by auth params', async () => {
		const token = {
			baseUrl: 'foo',
			hash: 'test_301450ef1f7691b352802c50407a4d05',
			name: 'bar',
			expires: {
				access: Date.now() + 1e6
			}
		};
		const tokenStore = new MemoryStore();
		await tokenStore.set(token);
		const { account } = await getAccount({
			baseUrl: 'foo',
			clientId: 'test',
			clientSecret: 'shhhh',
			realm: 'baz',
			tokenStore
		});
		expect(account).to.deep.equal(token);
	});

	it('should find an access token by id', async () => {
		const token = {
			baseUrl: 'foo',
			hash: 'test_301450ef1f7691b352802c50407a4d05',
			name: 'bar',
			expires: {
				access: Date.now() + 1e6
			}
		};
		const tokenStore = new MemoryStore();
		await tokenStore.set(token);
		const { account } = await getAccount({ tokenStore }, 'test_301450ef1f7691b352802c50407a4d05');
		expect(account).to.deep.equal(token);
	});

	it('should not find an access token by auth params', async () => {
		const tokenStore = new MemoryStore();
		const { account } = await getAccount({ tokenStore });
		expect(account).to.equal(null);
	});

	it('should not find an access token by id', async () => {
		const tokenStore = new MemoryStore();
		const { account } = await getAccount({ tokenStore }, 'foo');
		expect(account).to.equal(null);
	});
});
