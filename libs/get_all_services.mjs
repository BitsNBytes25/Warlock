import {getAllApplications} from "./get_all_applications.mjs";
import {logger} from "./logger.mjs";
import {getServicesStatus} from "./get_services_status.mjs";

/**
 * Get all services from all applications across all hosts
 *
 * @returns {Promise<[{service:ServiceData, app:AppData, host:HostAppData}]>}
 */
export async function getAllServices() {
	return new Promise((resolve, reject) => {
		getAllApplications()
			.then(results => {
				let allLookups = [],
					services = [];

				for (let guid in results) {
					let app = results[guid];
					for (let hostData of app.hosts) {
						allLookups.push(getServicesStatus(app, hostData));
					}
				}

				Promise.allSettled(allLookups)
					.then(serviceResults => {
						serviceResults.forEach(result => {
							logger.debug(result);
							if (result.status === 'fulfilled') {
								let appServices = result.value.services;
								for (let svc of Object.values(appServices)) {
									// Merge extra fields into service data
									services.push({service: svc, app: result.value.app.guid, host: result.value.host} );
								}
							}
						});

						resolve(services);
					});
			})
	});
}
