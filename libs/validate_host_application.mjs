import { getAllApplications } from './get_all_applications.mjs';

/**
 *
 * @param host
 * @param guid
 * @returns {Promise<Object.<app: AppData, host: HostAppData>>}
 */
export async function validateHostApplication(host, guid) {
	return new Promise((resolve, reject) => {
		getAllApplications()
			.then(applications => {
				const app = applications[guid] || null;

				if (!app) {
					return reject(new Error(`Application with GUID '${guid}' not found`));
				}

				app.hosts.forEach(hostData => {
					if (hostData.host === host) {
						return resolve({
							app: app,
							host: hostData
						});
					}

					// If the host is not found, we can immediately reject the lookup.
					return reject(new Error(`Host '${host}' does not have application installed with GUID '${guid}'`));
				});
			});
	});
}
