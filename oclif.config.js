/** @type {import('@oclif/core').Config} */
export default {
	bin: 'axway',
	commands: './dist/commands',
	dirname: 'axway',
	theme: 'theme.json',
	topicSeparator: ' ',
	flexibleTaxonomy: true,
	plugins: [
		'@oclif/plugin-autocomplete'
	],
	hooks: {
		command_incomplete: './dist/hooks/command_incomplete/prompt',
		command_not_found: './dist/hooks/command_not_found/suggest',
		finally: [
			'./dist/hooks/finally/analytics',
			'./dist/hooks/finally/update'
		],
		init: [
			'./dist/hooks/init/init',
			'./dist/hooks/init/topic-summay'
		]
	}
}
