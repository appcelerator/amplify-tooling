import inquirer from 'inquirer';
import Separator from 'inquirer/lib/objects/separator.js';
import { lstatSync, Stats } from 'fs';
import { extname } from 'path';
//
// Basic Prompts
//

export type InputValidation = (input: string | number) => boolean | string;

/**
 * @param validators At least one InputValidation func
 * @description Executes the provided InputValidation funcs until all are successful, or one returns an error.
 * Pass to the askInput for validation when input validation becomes complex. Provides an easy way
 * to break down input validation into their own small functions.
 */
export const runValidations
	= (...validators: InputValidation[]): InputValidation =>
		(input: string | number) => {
			for (const validator of validators) {
				const res = validator(input);
				if (typeof res === 'string') {
					return res;
				}
			}
			return true;
		};

export const validateRegex
	= (regexp: string, message: string): InputValidation =>
		(input: string | number) => {
			return input.toString().match(regexp) ? true : message;
		};

export const validateInputLength
	= (length: number, message: string): InputValidation =>
		(input: string | number) => {
			return input.toString().length <= length ? true : message;
		};

export const MAX_FILE_SIZE = process.env.NODE_ENV === 'test' ? 1e5 : 20 * 1024 * 1024;

export const verifyApigeeXCredentialFile = (): InputValidation => (input: string | number) => {
	let stats: Stats;
	let fileExtension: string = '';
	try {
		stats = lstatSync(input as string);
		fileExtension = extname(input as string);
		if (!stats.isFile()) {
			throw new Error(`Couldn't load the credential file: ${input}`);
		} else if (stats.size >= MAX_FILE_SIZE) {
			throw new Error('File size too large');
		} else if (fileExtension !== '.json') {
			throw new Error('File extension is invalid, please provide \'.json\' file');
		}
		return true;
	} catch (e) {
		throw new Error(`Couldn't find the credential file: ${input}`);
	}
};

export const validateValidRegex = (): InputValidation => (input: string | number) => {
	try {
		new RegExp(input.toString());
	} catch (error) {
		return 'Please provide a valid regular expression.';
	}
	return true;
};

export const validateInputIsNew
	= (options: string[], error: string): InputValidation =>
		(input: string | number) => {
			const isFound = options.find((opt) => opt === input);
			return isFound ? error : true;
		};

export const validateValueRange
	= (lowerLimit?: number, upperLimit?: number): InputValidation =>
		(input: string | number) => {
			const inputNum = Number(input);
			if (isNaN(inputNum)) {
				return 'Please provide a number.';
			}

			let msg = '';
			if (lowerLimit !== undefined && upperLimit !== undefined) {
				msg = `Please provide a number from ${lowerLimit} to ${upperLimit}`;
			} else if (lowerLimit !== undefined) {
				msg = `Please provide a minimum number of ${lowerLimit}`;
			} else if (upperLimit !== undefined) {
				msg = `Please provide a maximum number of ${upperLimit}`;
			}

			if (lowerLimit !== undefined && inputNum < (lowerLimit as number)) {
				return msg;
			}

			if (upperLimit !== undefined && inputNum > (upperLimit as number)) {
				return msg;
			}

			return true;
		};

// exporting for test
export const validateNonEmptyInput: InputValidation = (input: string | number) => {
	return String(input).length ? true : 'Please provide a non-empty value.';
};

// exporting for test
export const filterEmptyNumberInput = (input: string) => {
	// clear the invalid input
	return Number.isNaN(input as any) ? '' : Number(input);
};

export const askInputValidation
	= (allowEmptyInput: boolean, validate?: InputValidation): InputValidation =>
		(input: string | number) => {
			if (allowEmptyInput && !String(input).length) {
				return true;
			}
			const isEmpty = allowEmptyInput ? true : validateNonEmptyInput(input);
			if (typeof isEmpty === 'string') {
				return isEmpty;
			}
			return validate ? validate(input) : true;
		};

export const askInput = async ({
	msg,
	defaultValue,
	type = 'string',
	validate,
	allowEmptyInput = false,
}: {
	msg: string;
	defaultValue?: string | number;
	type?: 'string' | 'number';
	validate?: InputValidation;
	allowEmptyInput?: boolean;
}): Promise<string | number> => {
	const answers = await inquirer.prompt({
		type: type === 'string' ? 'input' : 'number',
		name: 'value',
		message: `${msg}: `,
		default: defaultValue,
		validate: askInputValidation(allowEmptyInput, validate),
		filter: type === 'number' ? filterEmptyNumberInput : undefined,
	});
	return answers.value;
};

export const askList = async (opts: {
	msg: string;
	choices: (string | { name: string; value: string } | Separator)[];
	default?: string;
}): Promise<string> => {
	const answers = await inquirer.prompt({
		type: 'list',
		name: 'value',
		message: `${opts.msg}: `,
		choices: opts.choices,
		default: opts.default,
	});
	return answers.value;
};

export const askUsernameAndPassword = async (
	msg: string,
	defaultUsername: string
): Promise<{ username: string; password: string }> => {
	const answers = await inquirer.prompt([
		{
			type: 'input',
			name: 'username',
			message: `Enter ${msg} username: `,
			default: defaultUsername,
			validate: validateNonEmptyInput,
		},
		{
			type: 'password',
			name: 'password',
			mask: '*',
			message: `Enter ${msg} password: `,
			validate: validateNonEmptyInput,
		},
	]);
	return answers;
};
