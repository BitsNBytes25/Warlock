import { fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import {Host} from "../db.js";
import {logger} from "./logger.mjs";
import cache from "./cache.mjs";
import {HostData} from "./host_data.mjs";

/**
 * Get all applications from /var/lib/warlock/*.app registration files
 * *
 * @returns {Promise<AppData[]>}
 */
export async function getAllApplications() {
	return new Promise((resolve, reject) => {
		let applications = {},
			cachedApplications = cache.get('all_applications'),
			appCount = 0,
			installCount = 0;

		if (cachedApplications) {
			logger.debug('getAllApplications: Fetched cached application list');
			applications = cachedApplications;
		}
		else {
			const appsFilePath = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'Apps.yaml');
			if (!fs.existsSync(appsFilePath)) {
				return reject(new Error(`Applications definition file not found at path: ${appsFilePath}`));
			}

			// Open Apps.yaml and parse it for the list of applications
			const data = yaml.load(fs.readFileSync(appsFilePath, 'utf8'), {});
			if (data) {
				data.forEach(item => {
					applications[ item.guid ] = item;
					applications[ item.guid ].installs = [];
				});
				cache.set('all_applications', applications, 3600);
			}
		}

		appCount = Object.keys(applications).length;
		logger.debug('getAllApplications: Loading application definitions from hosts');
		Host.findAll().then(async hosts => {
			if (hosts.length === 0) {
				logger.debug('getAllApplications: No hosts found in database.');
				return reject(new Error('No hosts found in database.'));
			}

			let promises = [];

			hosts.forEach(host => {
				const hostData = new HostData(host.ip);

				promises.push(
					hostData.getInstalls().then(installs => {
						installs.forEach(install => {
							if (!applications[install.guid]) {
								applications[install.guid] = {
									guid: install.guid,
									title: install.guid,
									description: 'No description available',
									installs: []
								};
							}
							applications[install.guid]['installs'].push(install);
							installCount++;
						});
					})
				);
			});

			// Wait for all lookups to complete before proceeding
			await Promise.allSettled(promises);

			logger.debug(`getAllApplications: Application Definitions Loaded with ${appCount} apps and ${installCount} installs.`);
			return resolve(Object.values(applications));
		});
	});
}
