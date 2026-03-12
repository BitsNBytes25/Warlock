import {getAllApplications} from "./get_all_applications.mjs";
import {logger} from "./logger.mjs";
import {getApplicationServices} from "./get_application_services.mjs";

/**
 * Get all services from all applications across all hosts
 *
 * @returns {Promise<[{service:ServiceData, app:AppData, host:AppInstallData}]>}
 */
export async function getAllServices() {
	return getAllApplications()
		.then(async results => {
			let allLookups = [],
				services = [];

			for (let guid in results) {
				let app = results[guid];
				for (let hostData of app.installs) {
					allLookups.push(
						hostData.getServices().then(hostServices => {
							for (let s of Object.keys(hostServices)) {
								services.push({service: hostServices[s], host: hostData});
							}
						})
					);
				}
			}

			await Promise.allSettled(allLookups);
			return services;
		})
		.catch(e => {
			logger.warn('getAllServices error:', e);
			return [];
		});
}
