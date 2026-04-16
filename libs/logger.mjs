/**
 * A simple logger utility that provides debug, info, warn, and error logging methods.
 * Debug messages are only logged in development mode.
 */

const color = {
	reset: '\x1b[0m',
	gray: '\x1b[90m',
	blue: '\x1b[34m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	orange: '\x1b[38;5;208m', // 256-color orange
	red: '\x1b[31m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[97m'
};

export const logger = {
	/**
	 * Log debug messages (only in development mode)
	 *
	 * @param args
	 */
	debug: (...args) => {
		if (process.env.NODE_ENV === 'development') {
			console.debug(`${color.gray}[${(new Date()).toISOString()}] [debug]${color.reset}`, ...args);
		}
	},
	/**
	 * Log informational messages
	 * @param args
	 */
	info: (...args) => {
		console.log(`${color.cyan}[${(new Date()).toISOString()}] [info]${color.reset}`, ...args);
	},
	/**
	 * Log warning messages
	 * @param args
	 */
	warn: (...args) => {
		console.warn(`${color.orange}[${(new Date()).toISOString()}] [warn]${color.reset}`, ...args);
	},
	/**
	 * Log error messages
	 * @param args
	 */
	error: (...args) => {
		console.error(`${color.red}[${(new Date()).toISOString()}] [error]${color.reset}`, ...args);
	}
};
