import {cmdRunner} from "./cmd_runner.mjs";
import {logger} from "./logger.mjs";

/**
 * Class representing the application data for a specific host and application path.
 *
 * Usage:
 *
 * ```js
 * const hostAppData = new HostAppData('hostname', '/path/to/app');
 * await hostAppData.init();
 * console.log(hostAppData.options); // List of available command options
 * ```
 */
export class HostAppData {
	/**
	 * Create a HostAppData instance.
	 *
	 * @param {string} host - Hostname or IP of host.
	 * @param {string} path - Path where the application is installed on the host.
	 */
	constructor(host, path) {
		this.host = host;
		this.path = path;
		this.options = [];
		this.version = 1;
	}

	/**
	 * Initialize the HostAppData by retrieving the available command options from the application.
	 *
	 * This method executes the application's manage.py with the --help option to parse the supported commands and options.
	 *
	 * @returns {Promise<void>}
	 */
	async init() {
		cmdRunner(this.host, `${this.path}/manage.py --help`, {}, 86400)
			.then(result => {
				let options = [],
					version = 1,
					in_commands = false,
					match = null;
				const helpText = result.stdout.split('\n').map(line => line.trim());

				for(let line of helpText) {
					if(line.startsWith('╭─ Commands')) {
						version = 2;
						in_commands = true;
					}
					else if(line.startsWith('options:')) {
						version = 1;
						in_commands = true;
					}

					if (in_commands) {
						if (version === 1 && (match = line.match(/^--([a-zA-Z0-9_-]+)\s.*$/))) {
							// Version 1 uses '--option' format
							options.push(match[1]);
						}
						else if (version === 2 && (match = line.match(/^\│ ([a-zA-Z0-9_-]+)\s+.*$/))) {
							// Version 2 uses a table format with '│ option description'
							options.push(match[1]);
						}
					}
				}

				this.options = options;
				this.version = version;
			})
			.catch(error => {
				logger.warn(`HostAppData.init: Error retrieving options for app at ${this.host}: ${error.message}`);
			});
	}

	/**
	 * Generate the command string to execute manage.py with the given option and arguments.
	 *
	 * @param {string} option - The command option to execute (e.g., 'start', 'restart').
	 * @param {...string[]} args - Additional arguments to pass to the command.
	 * @returns {string} The full command string to execute.
	 */
	getCommandString(option, ...args) {
		if (!this.options.includes(option)) {
			throw new Error(`Option '${option}' is not supported by ${this.path} on ${this.host}`);
		}
		const argsString = args.map(arg => {
			if (arg.includes(' ') || arg.includes('"')) {
				return `"${arg.replace(/"/g, '\\"')}"`;
			}
			return arg;
		}).join(' ');

		if (this.version === 1) {
			return `${this.path}/manage.py --${option} ${argsString}`.trim();
		}
		else if (this.version === 2) {
			return `${this.path}/manage.py ${option} ${argsString}`.trim();
		}
		else {
			throw new Error(`Unsupported application version ${this.version} for ${this.path} on ${this.host}`);
		}
	}

	/**
	 * Generate the command string to execute manage.py with the given option and arguments.
	 *
	 * @param {string} option - The command option to execute (e.g., 'start', 'restart').
	 * @param {string} service - The service name to target with the command (e.g., 'myservice').
	 * @param {...string[]} args - Additional arguments to pass to the command.
	 * @returns {string} The full command string to execute.
	 */
	getServiceCommandString(option, service, ...args) {
		if (!this.options.includes(option)) {
			throw new Error(`Option '${option}' is not supported by ${this.path} on ${this.host}`);
		}
		const argsString = args.map(arg => {
			if (typeof(arg) == 'boolean') {
				return arg ? 'true' : 'false';
			}
			if (typeof(arg) == 'number') {
				return arg.toString();
			}
			if (arg.startsWith('"') && arg.endsWith('"')) {
				return arg; // Already quoted, assume properly escaped
			}
			if (arg.startsWith("'") && arg.endsWith("'")) {
				return arg; // Already quoted, assume properly escaped
			}
			if (arg.includes(' ') || arg.includes('"')) {
				return `"${arg.replace(/"/g, '\\"')}"`;
			}
			return arg;
		}).join(' ');

		if (this.version === 1) {
			return `${this.path}/manage.py --service "${service}" --${option} ${argsString}`.trim();
		}
		else if (this.version === 2) {
			return `${this.path}/manage.py ${option} --service "${service}" ${argsString}`.trim();
		}
		else {
			throw new Error(`Unsupported application version ${this.version} for ${this.path} on ${this.host}`);
		}
	}
}
