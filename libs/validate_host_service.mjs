import { getAllApplications } from './get_all_applications.mjs';
import { getServicesStatus } from './get_services_status.mjs';

/**
 *
 * @param host
 * @param guid
 * @param service
 * @returns {Promise<Object.<app: AppData, host: HostAppData, service: ServiceData>>}
 */
export async function validateHostService(host, guid, service) {
	return new Promise((resolve, reject) => {
		getAllApplications()
			.then(applications => {
				const app = applications[guid] || null;
				let found = false;

				if (!app) {
					return reject(new Error(`Application with GUID '${guid}' not found`));
				}

				app.hosts.forEach(hostData => {
					if (hostData.host === host) {
						found = true;

						// Check if the service exists on the target host for this application
						getServicesStatus(app, hostData)
							.then(serviceResults => {
								const svc = serviceResults.services[service] || null;

								if (!svc) {
									reject(new Error(`Service '${service}' not found in application '${guid}' on host '${host}'`));
								}

								return resolve({
									app: app,
									host: hostData,
									service: svc
								});
							})
							.catch(error => {
								return reject(new Error(`Error retrieving services for application '${guid}' on host '${host}': ${error.message}`));
							});
					}

					if (!found) {
						// If the host is not found, we can immediately reject the lookup.
						return reject(new Error(`Host '${host}' does not have application installed with GUID '${guid}'`));
					}
				});
			});
	});
}
