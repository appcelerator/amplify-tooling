import Command from '../../../lib/command.js';

export default class EngageCreateServiceAccount extends Command {
	static override summary = 'Create a service account.';
	static override aliases = [ 'central:create:service-account', 'central:create:serviceaccount', 'central:create:service account', 'engage:create:serviceaccount', 'engage:create:service account' ];

	static override hidden = true; // no longer supported, but keeping the command here for now to avoid breaking any existing scripts that may be using it

	async run(): Promise<any> {
		throw new Error(
			'Creating a service account via "engage" is no longer supported. '
		+ 'Use the "axway" CLI instead. '
		+ 'Example: "axway service-account create [options]"');
	}
}
