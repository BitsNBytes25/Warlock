import {cmdRunner} from "./cmd_runner.mjs";
import {logger} from "./logger.mjs";
import {VersionCompare} from "./version_compare.mjs";

/**
 * Class representing the application data for a specific host and application path.
 *
 * Usage:
 *
 * ```js
 * const appInstallData = new AppInstallData('hostname', '/path/to/app');
 * await appInstallData.init();
 * console.log(appInstallData.options); // List of available command options
 * ```
 */
export class AppInstallData {
	/**
	 * Create an AppInstallData instance.
	 *
	 * @param {string} host - Hostname or IP of host.
	 * @param {string} path - Path where the application is installed on the host.
	 */
	constructor(host, path) {
		this.host = host;
		this.path = path;
		this.guid = null;
		this.title = null;
		this.options = [];
		this.version = 1;
	}

	toJSON() {
		const data = {};
		for (const key of Object.keys(this)) {
			if (!key.startsWith('_')) {
				data[key] = this[key];
			}
		}
		return data;
	}

	/**
	 * Initialize the AppInstallData by retrieving the available command options from the application.
	 *
	 * This method executes the application's manage.py with the --help option to parse the supported commands and options.
	 *
	 * @returns {Promise<void>}
	 */
	async init() {
		return cmdRunner(this.host, `${this.path}/manage.py --help`, 86400)
			.then(result => {
				let options = [],
					version = null,
					in_commands = false,
					match = null;
				const helpText = result.stdout.split('\n').map(line => line.trim());

				for(let line of helpText) {
					if (line.trim().startsWith('Warlock Manager: ')) {
						// V2.1.2+ of Warlock Manager supports rendering the actual version, no more guess work!
						version = line.trim().split(' ')[2];
					}
					else if(line.startsWith('╭─ Commands')) {
						if (version === null) {
							version = 2;
						}
						in_commands = true;
					}
					else if(line.startsWith('options:')) {
						version = 1;
						in_commands = true;
					}

					if (in_commands && version !== null) {
						if (VersionCompare.satisfies(version, '^1.0.0') && (match = line.match(/^--([a-zA-Z0-9_-]+)\s.*$/))) {
							// Version 1 uses '--option' format
							options.push(match[1]);
						}
						else if (VersionCompare.ge(version, '2.0.0') && (match = line.match(/^\│ ([a-zA-Z0-9_-]+)\s+.*$/))) {
							// Version 2 uses a table format with '│ option description'
							options.push(match[1]);
						}
					}
				}

				this.options = options;
				this.version = version;
			})
			.catch(error => {
				logger.warn(`AppInstallData.init: Error retrieving options for app at ${this.host}: ${error.message}`);
			});
	}

	_argsParse = args => {
		return args.map(arg => {
			if (typeof (arg) == 'boolean') {
				return arg ? 'true' : 'false';
			}
			if (typeof (arg) == 'number') {
				return arg.toString();
			}
			if (arg === null || arg === undefined) {
				return '';
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
		const argsString = this._argsParse(args);

		if (VersionCompare.satisfies(this.version, '^1.0.0')) {
			return `${this.path}/manage.py --${option} ${argsString}`.trim();
		}
		else if (VersionCompare.ge(this.version, '2.0.0')) {
			return `${this.path}/manage.py ${option} ${argsString}`.trim();
		}
		else {
			throw new Error(`Unsupported application version ${this.version} for ${this.path} on ${this.host}`);
		}
	}

	/**
	 * Generate the command string to execute manage.py with the given option and arguments.
	 *
	 * Usage:
	 *
	 * ```js
	 * const appInstallData = new AppInstallData('hostname', '/path/to/app');
	 * await appInstallData.init();
	 * console.log(appInstallData.getServiceCommandString('start', 'myservice'));
	 * ```
	 *
	 * Parameters can be passed as additional arguments.
	 *
	 * ```js
	 * const appInstallData = new AppInstallData('hostname', '/path/to/app');
	 * await appInstallData.init();
	 * console.log(appInstallData.getServiceCommandString('start', 'myservice', '--port', 8080));
	 * ```
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
		const argsString = this._argsParse(args);

		if (VersionCompare.satisfies(this.version, '^1.0.0')) {
			return `${this.path}/manage.py --service "${service}" --${option} ${argsString}`.trim();
		}
		else if (VersionCompare.ge(this.version, '2.0.0')) {
			return `${this.path}/manage.py ${option} --service "${service}" ${argsString}`.trim();
		}
		else {
			throw new Error(`Unsupported application version ${this.version} for ${this.path} on ${this.host}`);
		}
	}

	/**
	 * Get all service instances in this host application.
	 *
	 * @returns {Promise<Object<string, ServiceData>>}
	 */
	async getServices() {
		return cmdRunner(this.host, this.getCommandString('get-services'), 3600, this.guid)
			.then(result => {
				try {
					let services = JSON.parse(result.stdout);
					// Standardize some data for each service, notably app_dir, bak_dir, and add multi_binary.
					for(let service in services) {
						services[service].app_dir = services[service].app_dir || (this.path + '/AppFiles');
						services[service].bak_dir = services[service].bak_dir || (this.path + '/backups');
						services[service].multi_binary = services[service].app_dir !== this.path + '/AppFiles';

						// Remove some keys which are now unused
						delete services[service].start_exec;
						delete services[service].pre_exec;
					}
					return services;
				}
				catch(e) {
					throw new Error(`Error parsing services data for application '${this.guid}' on host '${this.host}': ${e.message}`);
				}
			})
			.catch(e => {
				throw new Error(`Error retrieving services data for application '${this.guid}' on host '${this.host}': ${e.message}`);
			});
	}

	/**
	 * Get a specific service instance by name.
	 *
	 * @param {string} service
	 * @returns {Promise<ServiceData|null>}
	 */
	async getService(service) {
		const services = await this.getServices();
		return services[service] || null;
	}
}
