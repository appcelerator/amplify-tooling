const errors = {};
export default errors;

createError('AUTH_FAILED',                Error,      'Authorization failed');
createError('AUTH_TIMEOUT',               Error,      'A successful login did not happen within the allowed time');
createError('INVALID_ARGUMENT',           TypeError,  'A function argument is undefined or the incorrect data type');
createError('INVALID_BASE_URL',           Error,      'Invalid base URL');
createError('INVALID_FILE',               Error,      'The file does not exist or access is denied');
createError('INVALID_PARAMETER',          TypeError,  'A parameter was not a valid value or type');
createError('INVALID_RANGE',              RangeError, 'The value is not within the acceptable min/max range');
createError('INVALID_VALUE',              Error,      'The specified value is an accepted value');
createError('LOGIN_REQUIRED',             Error,      'Login is required');
createError('KEYTAR_NOT_FOUND',           Error,      'The token store could not find keytar');
createError('MISSING_AUTH_CODE',          TypeError,  'An authorization code was expected');
createError('MISSING_REQUIRED_PARAMETER', TypeError,  'A required parameter was not specified or not a valid type');

/**
 * Creates an the error object and populates the message, code, and metadata.
 *
 * @param {String} code - The error code.
 * @param {Error|RangeError|TypeError} type - An instantiable error object.
 * @param {String} desc - A generic error description.
 */
function createError(code, type, desc) {
	errors[code] = function (msg, meta) {
		const err = new type(msg);

		if (desc) {
			if (!meta) {
				meta = {};
			}
			meta.desc = desc;
		}

		return Object.defineProperties(err, {
			code: {
				configurable: true,
				enumerable: true,
				writable: true,
				value: `ERR_${code}`
			},
			meta: {
				configurable: true,
				value: meta || undefined,
				writable: true
			},
			name: {
				configurable: true,
				value: code,
				writable: true
			},
			toString: {
				configurable: true,
				value: function toString() {
					return `ERR_${code}`;
				},
				writable: true
			}
		});
	};
}
