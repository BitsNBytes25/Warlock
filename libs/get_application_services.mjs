import {cmdRunner} from "./cmd_runner.mjs";
import cache from "./cache.mjs";

/**
 * Get the services for a single application on a given host
 *
 * @param appData {AppData}
 * @param hostData {AppInstallData}
 * @returns {Promise<{services:Object.<{string}, ServiceData>, app:AppData, host:AppInstallData}>}
 */
export async function getApplicationServices(appData, hostData) {
	return new Promise((resolve, reject) => {

		const guid = appData.guid;

		cmdRunner(hostData.host, hostData.getCommandString('get-services'), 3600)
			.then(result => {
				let appServices = {};

				try {
					appServices = JSON.parse(result.stdout);
				}
				catch(e) {
					return reject(new Error(`Error parsing services data for application '${guid}' on host '${hostData.host}': ${e.message}`));
				}

				return resolve({
					app: appData,
					host: hostData,
					services: appServices
				});
			})
			.catch(e => {
				return reject(new Error(`Error retrieving services for application '${guid}' on host '${hostData.host}': ${e.error.message}`));
			});
	});
}
