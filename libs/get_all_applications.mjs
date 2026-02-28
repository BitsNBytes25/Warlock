import { fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import {cmdRunner} from "./cmd_runner.mjs";
import {Host} from "../db.js";
import {logger} from "./logger.mjs";
import cache from "./cache.mjs";
import {HostAppData} from "./host_app_data.mjs";

/**
 * Get all applications from /var/lib/warlock/*.app registration files
 * *
 * @returns {Promise<Object.<string, AppData>>}
 */
export async function getAllApplications() {
	return new Promise((resolve, reject) => {
		let applications = {};
		let cachedApplications = cache.get('all_applications');

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
					applications[ item.guid ].hosts = [];
				});
				cache.set('all_applications', applications, 3600);
			}
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
				promises.push(cmdRunner(host, cmd, {host}, 86400));
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

									const hostAppData = new HostAppData(target, path.trim());
									applications[guid]['hosts'].push(hostAppData);

									lookupPromises.push(hostAppData.init());
								}
							}
						}
					});

					Promise.allSettled(lookupPromises)
						.then(() => {
							logger.debug('getAllApplications: Application Definitions Loaded', applications);
							return resolve(applications);
						});
				});
		});
	});
}
