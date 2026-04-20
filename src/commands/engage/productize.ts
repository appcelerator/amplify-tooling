import { Flags } from '@oclif/core';
import Command from '../../lib/command.js';
import logger, { highlight } from '../../lib/logger.js';
import { commonFlags } from '../../lib/engage/flags.js';
import Renderer from '../../lib/engage/results/renderer.js';
import { productizeResources } from '../../lib/engage/services/productize-service.js';

export class EngageProductize extends Command {
	static override summary = 'Productize one or more API Services from a file.';

	static override aliases = [ 'central:productize' ];

	static override description = `You must be authenticated to productize one or more API Services.
    Run ${highlight('"axway auth login"')} to authenticate.`;

	static override examples = [
		{
			description: 'Productize an API Service from a file',
			command: '<%= config.bin %> <%= command.id %> <Resource> --file <FilePath>',
		},
	];

	static override flags = {
		...commonFlags,
		file: Flags.string({
			char: 'f',
			description: 'Filename to use to create the resource.',
		}),
		transferOwnership: Flags.boolean({
			description: 'Transfers the ownership(if exisiting) of API Service(s) to corresponding Asset(s) and Product(s)',
		}),
	};

	async run(): Promise<void> {
		const log = logger('engage:productize');
		const { flags, account } = await this.parse(EngageProductize);

		if (!flags.file) {
			throw new Error('To create resources from a file, please provide -f, --file [path] option');
		}

		const render = new Renderer(console, flags.output).startSpin('Productizing API Service(s)');
		let commandIsSuccessful = true;
		try {
			const results = await productizeResources({
				account,
				filePath: flags.file,
				transferOwnership: flags.transferOwnership || false,
			});
			render.stopSpin();
			render.productizationResult(results.results);
			results?.results.forEach((value) => {
				if (value.error.length > 0) {
					commandIsSuccessful = false;
				}
			});
		} catch (err: any) {
			log('command error', err);
			render.anyError(err);
		} finally {
			log(`command finished, success = ${commandIsSuccessful}`);
			if (!commandIsSuccessful) {
				process.exit(1);
			}
		}
	}
}
