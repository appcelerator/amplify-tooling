/** This type is returnd by the CompositeError.toDictionary() method. Intended to be outputted to JSON or YAML. */
export interface CompositeErrorDictionary {
	/** Name of the error type such as "CompositeError", "TypeError", "RangeError", etc. */
	name: string;

	/** The error object's message. */
	message: string;

	/** Provides array of errors if this is a CompositeError type. Will be undefined for other error types. */
	nestedErrors?: CompositeErrorDictionary[];
}

/** Error object which can provide nested errors to indicated if multiple errors have occurred. */
export class CompositeError extends Error {
	/** Array of errors wrapped by this error object. */
	#nestedErrors: Error[];

	/**
	 * Creates a new error wrapping the given array of errors.
	 * @param errors Array of errors to be owned by this composite error. Can contain CompositeError instances.
	 * @param message Optional error message to be displayed by this root error object.
	 */
	constructor(errors: Error[], message?: string) {
		super(message);
		this.#nestedErrors = errors;
	}

	/** Gets the name of this error type. */
	get name(): string {
		return 'CompositeError';
	}

	/** Gets an array of error objects owned by this composite error. */
	get nestedErrors(): Error[] {
		return this.#nestedErrors;
	}

	/**
	 * Creates a dictionary providing the name, message, and array of all errors nested under this error object.
	 * Intended to be outputted to JSON or YAML.
	 * @returns Returns a dictionary of this error object and all nested error objects.
	 */
	toDictionary(): CompositeErrorDictionary {
		const dictionary: CompositeErrorDictionary = {
			name: this.name,
			message: this.message,
			nestedErrors: [],
		};
		for (const nextError of this.#nestedErrors) {
			if (nextError instanceof CompositeError) {
				dictionary.nestedErrors!.push(nextError.toDictionary());
			} else {
				dictionary.nestedErrors!.push({
					name: nextError.name,
					message: nextError.message,
				});
			}
		}
		return dictionary;
	}

	/**
	 * Creates an array of strings providing this object's error message and all of its nested error messages.
	 * Each error object's message is added to its own array entry and will be indented according to nested position.
	 * @returns Returns an array of all error messages that are indented according to their nested position.
	 */
	toNestedMessageArray(): string[] {
		const messageLines: string[] = [];
		if (this.message) {
			messageLines.push(this.message);
		}
		for (const nextError of this.#nestedErrors) {
			if (nextError instanceof CompositeError) {
				for (const nextLine of nextError.toNestedMessageArray()) {
					const prefix = nextLine.startsWith('-') ? '  ' : '* ';
					messageLines.push(prefix + nextLine);
				}
			} else {
				messageLines.push(`- ${nextError.message || 'Unknown error'}`);
			}
		}
		return messageLines;
	}

	/**
	 * Creates an error message containing this object's message and all nested error messages separated by newlines
	 * and indented according to their nested position.
	 * @returns Returns a single string containing all nested error messages separated by newlines.
	 */
	toNestedMessageString(): string {
		return this.toNestedMessageArray().join('\n');
	}
}
