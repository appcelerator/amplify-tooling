import { heading, highlight } from '../lib/logger.js';

const baseCliCommand = 'axway';

const completionZsh = `###-begin-axway-cli-completions-###
_axway_cli_completions() {
	local cur
	cur=\${words[CURRENT]}
	local prev
	prev=\${words[CURRENT-1]}
	local options

	# If previous argument ends with -file, complete with file paths
	if [[ "\${prev}" == *-file ]]; then
		_files
	else
		options="$(AXWAY_TELEMETRY_DISABLED=1 NO_UPDATE_NOTIFIER=1 ${baseCliCommand} completion --get-completions "\${words[@]}")"
		options=("\${(@f)options}")
		_describe 'values' options
	fi
}
compdef _axway_cli_completions ${baseCliCommand}
###-end-axway-cli-completions-###
`;

const completionBash = `###-begin-axway-cli-completions-###
_axway_cli_completions() {
	local cur="\${COMP_WORDS[COMP_CWORD]}"
	local prev="\${COMP_WORDS[COMP_CWORD-1]}"
	local options=$(AXWAY_TELEMETRY_DISABLED=1 NO_UPDATE_NOTIFIER=1 ${baseCliCommand} completion --get-completions \${COMP_WORDS[@]})

	# If previous argument ends with -file, complete with file paths
	if [[ "\${prev}" == *-file ]]; then
		COMPREPLY=(\$(compgen -f -- "\${cur}"))
	else
		COMPREPLY=(\$(compgen -W "\${options}" -- "\${cur}"))
	fi
}
complete -F _axway_cli_completions ${baseCliCommand}
###-end-axway-cli-completions-###
`;

export default {
	args: [ {
		name: 'args...',
		hidden: true, // used only by autocompletion script itself
	} ],
	desc: 'Output or generate shell completion code',
	banner: false,
	help: {
		header() {
			return `The Axway CLI can generate shell completion code for bash and zsh.

To enable autocompletion, you can add the output of this command to your
shell's configuration file (e.g. ~/.bashrc or ~/.zshrc).

You will need to restart your shell or source the configuration file for the
changes to take effect.

Once enabled, you can type part of a command and press tab to see available
commands and options.`;
		},
		footer() {
			return `${heading('Examples:')}

  Add autocompletion for bash:
    ${highlight('echo "source <(axway completion --bash)" >> ~/.bashrc')}

  Add autocompletion for zsh:
    ${highlight('echo "source <(axway completion --zsh)" >> ~/.zshrc')}`;
		}
	},
	options: {
		'--get-completions': {
			type: 'bool',
			hidden: true, // used only by autocompletion script itself
		},
		'--zsh': {
			type: 'bool',
			desc: 'Autocompletion script for zsh',
		},
		'--bash': {
			type: 'bool',
			desc: 'Autocompletion script for bash',
		},
	},
	action: function ({ argv, console }: { argv: any; console: Console }) {
		if (argv.zsh) {
			return console.log(completionZsh);
		}
		if (argv.bash) {
			return console.log(completionBash);
		}

		if (argv.getCompletions && argv.args[0] === baseCliCommand) {
			// get sub-commands from CLI-kit params
			let cmds = this.parent.commands;
			let opts = [];
			for (let i = 1; i < argv.args.length; i++) {
				const cmd = cmds.get(argv.args[i]);
				// Return any previously found commands and options if we can't find any new commands
				if (!cmd) {
					break;
				}
				cmds = cmd.commands;
				// If the command has options, add them to the list
				// to be returned if there are no sub-commands
				if (cmd.lookup) {
					opts = [];
					for (const longArg of Object.keys(cmd.lookup.long)) {
						opts.push(`--${longArg}`);
					}
				}
			}
			if (cmds && cmds.size > 0) {
				for (const cmd of cmds.keys()) {
					console.log(cmd);
				}
			} else if (opts.length > 0) {
				for (const opt of opts) {
					console.log(opt);
				}
			}
		}
	}
};
