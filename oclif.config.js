/** @type {import('@oclif/core').Config} */
export default {
	bin: 'axway',
	commands: './dist/commands',
	dirname: 'axway',
	theme: 'theme.json',
	topicSeparator: ' ',
	flexibleTaxonomy: true,
	plugins: [
		'@oclif/plugin-autocomplete',
		'@oclif/plugin-help'
	],
	hooks: {
		command_incomplete: './dist/hooks/command_incomplete/prompt',
		finally: [
			'./dist/hooks/finally/analytics',
			'./dist/hooks/finally/update'
		],
		init: './dist/hooks/init/init'
	}
}
