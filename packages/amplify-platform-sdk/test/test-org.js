import { getServerInfo } from '../dist/util';

describe('util', () => {
	describe('getServerInfo', () => {
		it('should error getting server info without a URL', async () => {
			try {
				await getServerInfo();
			} catch (err) {
				expect(err).to.be.instanceof(TypeError);
				expect(err.message).to.equal('Expected URL to be a non-empty string');
				return;
			}
			throw new Error('Expected error to be thrown');
		});

		it('should error getting server info with invalid URL', async () => {
			try {
				await getServerInfo('');
			} catch (err) {
				expect(err).to.be.instanceof(TypeError);
				expect(err.message).to.equal('Expected URL to be a non-empty string');
				return;
			}
			throw new Error('Expected error to be thrown');
		});
	});
});
