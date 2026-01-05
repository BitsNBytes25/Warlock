import { fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import {cmdRunner} from "./cmd_runner.mjs";
import {Host} from "../db.js";
import {logger} from "./logger.mjs";
import cache from "./cache.mjs";
import {lookup} from "passport-local/lib/utils.js";

/**
 * Get all applications from /var/lib/warlock/*.app registration files
 * *
 * @returns {Promise<Object.<string, AppData>>}
 */
export async function getAllApplications() {
	return new Promise((resolve, reject) => {
		let cachedApplications = cache.get('all_applications');
		if (cachedApplications) {
			logger.debug('getAllApplications: Returning cached application data');
			return resolve(cachedApplications);
		}

		const appsFilePath = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'Apps.yaml');
		if (!fs.existsSync(appsFilePath)) {
			return reject(new Error(`Applications definition file not found at path: ${appsFilePath}`));
		}

		// Open Apps.yaml and parse it for the list of applications
		let applications = {};
		const data = yaml.load(fs.readFileSync(appsFilePath, 'utf8'), {});
		if (data) {
			data.forEach(item => {
				applications[ item.guid ] = item;
				applications[ item.guid ].hosts = [];
			});
		}

		logger.debug('getAllApplications: Loading application definitions from hosts');
		Host.findAll().then(hosts => {
			const hostList = hosts.map(host => host.ip),
				cmd = 'for file in /var/lib/warlock/*.app; do if [ -f "$file" ]; then echo "$(basename "$file" ".app"):$(cat "$file")"; fi; done';

			if (hostList.length === 0) {
				logger.debug('getAllApplications: No hosts found in database.');
				return reject(new Error('No hosts found in database.'));
			}

			let promises = [],
				lookupPromises = [];

			hostList.forEach(host => {
				promises.push(cmdRunner(host, cmd, {host}));
			});

			Promise.allSettled(promises)
				.then(results => {
					results.forEach(result => {
						if (result.status === 'fulfilled') {
							const target = result.value.extraFields.host,
								stdout = result.value.stdout;

							for (let line of stdout.split('\n')) {
								if (line.trim()) {
									let [guid, path] = line.split(':').map(s => s.trim());

									// Add some data from the local apps definition if it's available
									if (!applications[guid]) {
										applications[guid] = {
											guid: guid,
											title: guid,
											description: 'No description available',
											hosts: []
										};
									}

									lookupPromises.push(
										getApplicationOptions(target, path.trim())
											.then(appData => {
												applications[guid]['hosts'].push(appData);
											})
									);
								}
							}
						}
					});

					Promise.allSettled(lookupPromises)
						.then(() => {
							// Cache the applications for 1 day
							cache.set('all_applications', applications, 86400);
							logger.debug('getAllApplications: Application Definitions Loaded', applications);
							return resolve(applications);
						});
				});
		});
	});
}

/**
 * Execute manage.py on the host with --help to retrieve the options available in this version of the application.
 *
 * Required because some game managers may support different options.
 *
 * @param {string} host Host IP or name
 * @param {string} path Path to the application on the host
 * @returns {Object<host:string, path:string, options:Array<string>>}
 */
async function getApplicationOptions(host, path) {
	return new Promise((resolve, reject) => {
		cmdRunner(host, `${path}/manage.py --help`)
			.then(result => {
				let options = [];
				const helpText = result.stdout;

				// Simple parsing of the help text to find available options
				const optionRegex = /--([a-zA-Z0-9_-]+)(\s+<[^>]+>)?/g;
				let match;
				while ((match = optionRegex.exec(helpText)) !== null) {
					options.push(match[1]);
				}

				resolve({
					host: host,
					path: path,
					options: options
				});
			})
			.catch(error => {
				logger.warn(`getApplicationOptions: Error retrieving options for app at ${host}: ${error.message}`);
				resolve({
					host: host,
					path: path,
					options: []
				});
			});
	});
}
