import NodeCacheStore from 'node-cache';
import {cmdRunner} from "./cmd_runner.mjs";

const cache = new NodeCacheStore();

/**
 * Get the details of a single service on a given host
 *
 * @param appData {AppData}
 * @param hostData {HostAppData}
 * @returns {Promise<{services:Object.<{string}, ServiceData>, app:AppData, host:HostAppData}>}
 */
export async function getServicesStatus(appData, hostData) {
	return new Promise((resolve, reject) => {

		const guid = appData.guid;

		let cachedServices = cache.get(`services_${guid}_${hostData.host}`);
		if (cachedServices) {
			return resolve({
				app: appData,
				host: hostData,
				services: cachedServices
			});
		}

		cmdRunner(hostData.host, `${hostData.path}/manage.py --get-services`)
			.then(result => {
				const appServices = JSON.parse(result.stdout);

				// Save this to cache for faster future lookups
				cache.set(`services_${guid}_${hostData.host}`, appServices, 10); // Cache for 10 seconds

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
