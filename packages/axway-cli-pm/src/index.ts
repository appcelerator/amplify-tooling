import { CLICommand, CLIHelpOptions } from 'cli-kit';

export default {
	commands: `${__dirname}/commands`,
	desc: 'Package manager for Axway products',
	help: {
		header(this: CLICommand) {
			return `${this.desc}.`;
		},
		footer({ style }: CLIHelpOptions): string {
			return `${style.heading('Examples:')}

  List all available packages:
    ${style.highlight('axway pm search')}

  View package details:
    ${style.highlight('axway pm view <package>')}

  Install a package:
    ${style.highlight('axway pm install <package>')}`;
		}
	}
};
