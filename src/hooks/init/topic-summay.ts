import { type Hook } from '@oclif/core';

// Oclif doesn't expose some config types publicly, so define the bits we need here
type oclifInternals = {
	_commands: Map<string, {  summary?: string; description?: string }>;
	_topics: Map<string, { description?: string }>;
}

/**
 * For some reason oclif doesn't use defined summaries on topic index commands, but the summary of the first sub-command instead.
 * This corrects that by overriding the topic descriptions with the summaries from the index definitions.
 * Oclif does allow manually defining topic descriptions in the oclif config, but this avoids duplication.
 */
const hook: Hook.Init = async function (opts: Parameters<Hook.Init>[0] & { config: oclifInternals }) {
	// Loop through all the topics to get the set of index topics
	const indexTopics = Array.from(opts.config._topics.keys()).reduce((topics, id) => {
		const sections = id.split(':');
		// If there is more than one section, it's a sub-command so there will be an owning topic to update
		if (sections.length > 1) {
			topics.add(sections.slice(0, -1).join(':'));
		}
		return topics;
	}, new Set<string>());

	// For each index topic, get the command definition and use its summary as the topic description
	for (const topic of indexTopics) {
		const command = opts.config._commands.get(topic);
		const description = command.summary || command.description;
		if (description) {
			opts.config._topics.set(topic, { ...opts.config._topics.get(topic), description });
		}
	}
};

export default hook;
