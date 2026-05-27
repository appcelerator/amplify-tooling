import { Help as DefaultHelp, CommandHelp as DefaultCommandHelp } from '@oclif/core';
import ansis from 'ansis';
import indentString from 'indent-string';
import stringWidth from 'string-width';
import widestLine from 'widest-line';
import wrapAnsi from 'wrap-ansi';

/**
 * Custom CommandHelp that preserves leading whitespace and supports custom sections.
 *
 * Commands can define a static `settings` property to add a custom SETTINGS section
 * to their help output. This section will appear before the DESCRIPTION section.
 */
class CommandHelp extends DefaultCommandHelp {
	/**
	 * Override sections to add custom SETTINGS section support.
	 *
	 * If a command defines a static `settings` property, this method will add a SETTINGS
	 * section to the help output, positioned before the DESCRIPTION section.
	 */
	override sections() {
		const defaultSections = super.sections();
		const cmd = this.command as any;

		if (cmd.settings) {
			const descriptionIndex = defaultSections.findIndex(s => s.header === 'DESCRIPTION');
			const settingsSection = {
				generate: () => this.wrap((cmd.settings as string)),
				header: 'SETTINGS',
			};

			if (descriptionIndex >= 0) {
				defaultSections.splice(descriptionIndex, 0, settingsSection);
			} else {
				defaultSections.push(settingsSection);
			}
		}

		return defaultSections;
	}

	/**
	 * Override wrap to preserve leading whitespace by passing trim: false to wrap-ansi
	 */
	override wrap(body: string, spacing = this.indentSpacing): string {
		const rendered = this.render(body);
		return wrapAnsi(rendered, this.opts.maxWidth - spacing, { hard: true, trim: false });
	}

	/**
	 * Override renderList to not trim() the right-side descriptions, preserving leading whitespace
	 */
	override renderList(
		input: (string | undefined)[][],
		opts: { indentation: number; multiline?: boolean; spacer?: string; stripAnsi?: boolean }
	): string {
		if (input.length === 0) {
			return '';
		}

		const renderMultiline = () => {
			let output = '';
			for (let [ left, right ] of input) {
				if (!left && !right) {
					continue;
				}

				if (left) {
					if (opts.stripAnsi) {
						left = ansis.strip(left);
					}
					output += this.wrap(left.trim(), opts.indentation);
				}

				if (right) {
					if (opts.stripAnsi) {
						right = ansis.strip(right);
					}
					output += '\n';
					// Changed: removed .trim() from right to preserve leading whitespace
					output += this.indent(this.wrap(right, opts.indentation + 2), 4);
				}

				output += '\n\n';
			}

			return output.trim();
		};

		if (opts.multiline) {
			return renderMultiline();
		}

		const maxLength = widestLine(input.map((i) => i[0]).join('\n'));
		let output = '';
		const spacer = opts.spacer || '\n';
		let cur = '';

		for (const [ left, r ] of input) {
			let right = r;
			if (cur) {
				output += spacer;
				output += cur;
			}

			cur = left ?? '';
			if (opts.stripAnsi) {
				cur = ansis.strip(cur);
			}
			cur = cur.trim();

			if (!right) {
				cur = cur.trim();
				continue;
			}

			if (opts.stripAnsi) {
				right = ansis.strip(right);
			}
			// Changed: removed .trim() from right to preserve leading whitespace
			right = this.wrap(right, opts.indentation + maxLength + 2);
			const [ first, ...lines ] = right.split('\n').map((s) => s.trimEnd());
			cur += ' '.repeat(maxLength - stringWidth(cur) + 2);
			cur += first;

			if (lines.length > 0) {
				// indent: maxLength + spacer + indentation
				cur += `\n${lines.map((s) => indentString(s, maxLength + 2 + 2)).join('\n')}`;
			}
		}

		if (cur) {
			output += spacer;
			output += cur;
		}

		return output.trim();
	}
}

/**
 * Custom Help class that preserves leading whitespace in help output.
 *
 * This class overrides oclif's default Help class to prevent the stripping of
 * leading whitespace in command descriptions and help text, allowing for properly
 * indented content.
 */
class Help extends DefaultHelp {
	/**
	 * Use our custom CommandHelp class that supports custom sections and preserves whitespace
	 */
	protected override CommandHelpClass = CommandHelp;

	/**
	 * Override wrap to preserve leading whitespace by passing trim: false to wrap-ansi
	 */
	override wrap(body: string, spacing = this.indentSpacing): string {
		const rendered = this.render(body);
		return wrapAnsi(rendered, this.opts.maxWidth - spacing, { hard: true, trim: false });
	}

	/**
	 * Override renderList to not trim() the right-side descriptions, preserving leading whitespace
	 */
	override renderList(
		input: (string | undefined)[][],
		opts: { indentation: number; multiline?: boolean; spacer?: string; stripAnsi?: boolean }
	): string {
		if (input.length === 0) {
			return '';
		}

		const renderMultiline = () => {
			let output = '';
			for (let [ left, right ] of input) {
				if (!left && !right) {
					continue;
				}

				if (left) {
					if (opts.stripAnsi) {
						left = ansis.strip(left);
					}
					output += this.wrap(left.trim(), opts.indentation);
				}

				if (right) {
					if (opts.stripAnsi) {
						right = ansis.strip(right);
					}
					output += '\n';
					// Changed: removed .trim() from right to preserve leading whitespace
					output += this.indent(this.wrap(right, opts.indentation + 2), 4);
				}

				output += '\n\n';
			}

			return output.trim();
		};

		if (opts.multiline) {
			return renderMultiline();
		}

		const maxLength = widestLine(input.map((i) => i[0]).join('\n'));
		let output = '';
		const spacer = opts.spacer || '\n';
		let cur = '';

		for (const [ left, r ] of input) {
			let right = r;
			if (cur) {
				output += spacer;
				output += cur;
			}

			cur = left ?? '';
			if (opts.stripAnsi) {
				cur = ansis.strip(cur);
			}
			cur = cur.trim();

			if (!right) {
				cur = cur.trim();
				continue;
			}

			if (opts.stripAnsi) {
				right = ansis.strip(right);
			}
			// Changed: removed .trim() from right to preserve leading whitespace
			right = this.wrap(right, opts.indentation + maxLength + 2);
			const [ first, ...lines ] = right.split('\n').map((s) => s.trimEnd());
			cur += ' '.repeat(maxLength - stringWidth(cur) + 2);
			cur += first;

			if (lines.length > 0) {
				// indent: maxLength + spacer + indentation
				cur += `\n${lines.map((s) => indentString(s, maxLength + 2 + 2)).join('\n')}`;
			}
		}

		if (cur) {
			output += spacer;
			output += cur;
		}

		return output.trim();
	}
}

export default Help;
