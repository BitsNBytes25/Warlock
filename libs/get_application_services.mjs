import {cmdRunner} from "./cmd_runner.mjs";
import cache from "./cache.mjs";

/**
 * Get the services for a single application on a given host
 *
 * @param appData {AppData}
 * @param hostData {HostAppData}
 * @returns {Promise<{services:Object.<{string}, ServiceData>, app:AppData, host:HostAppData}>}
 */
export async function getApplicationServices(appData, hostData) {
	return new Promise((resolve, reject) => {

		const guid = appData.guid;

		cmdRunner(hostData.host, hostData.getCommandString('get-services'), {}, 3600)
			.then(result => {
				let appServices = {},
					allData,
					keysInterestedIn = ['name', 'service', 'ip', 'port', 'enabled', 'max_players'];

				try {
					allData = JSON.parse(result.stdout);

					// We just want some basic information for each service.
					// Strictly this is not required, but it keeps the data size down
					// and helps avoid confusion if the developer looks at this data and wonders why some data is stale.

					for (let svcName in allData) {
						appServices[svcName] = {};
						for (let key of keysInterestedIn) {
							appServices[svcName][key] = typeof(allData[svcName][key]) === 'undefined' ? null : allData[svcName][key];
						}
					}
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
