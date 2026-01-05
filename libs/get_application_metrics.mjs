import {cmdRunner} from "./cmd_runner.mjs";
import {Metric} from "../db.js";
import {logger} from "./logger.mjs";

/**
 * Get the metrics of an application on a given host
 *
 * Optionally include the service name to only retrieve metrics for that service
 *
 * @param appData {AppData}
 * @param hostData {HostAppData}
 * @param service {string|null}
 * @returns {Promise<{services:Object.<{string}, ServiceData>, app:AppData, host:HostAppData, response_time:number}>}
 */
export async function getApplicationMetrics(appData, hostData, service = null) {
	return new Promise((resolve, reject) => {

		const guid = appData.guid,
			requestStartTime = Date.now();
		let cmd;

		if (hostData.options.includes('get-metrics')) {
			// Application supports service-level metrics collection
			if (service) {
				cmd = `${hostData.path}/manage.py --service ${service} --get-metrics`
			}
			else {
				cmd = `${hostData.path}/manage.py --get-metrics`
			}
		}
		else {
			// Fallback to general status of all services
			cmd = `${hostData.path}/manage.py --get-services`
		}


		cmdRunner(hostData.host, cmd)
			.then(async result => {
				let appServices;
				const responseTime = Date.now() - requestStartTime;

				try{
					appServices = JSON.parse(result.stdout);

					// Store the metrics as they are retrieved.
					// This is suitable to be done here since this method queries the live application.
					for (let svcName in appServices) {
						let svc = appServices[svcName];
						const timestamp = Math.floor(Date.now() / 1000);

						// Parse memory usage - handle MB and GB
						let memoryValue = 0;
						if (svc.memory_usage && svc.memory_usage !== 'N/A') {
							const memoryMatch = svc.memory_usage.match(/^([\d.]+)\s*(MB|GB)?/i);
							if (memoryMatch) {
								memoryValue = parseFloat(memoryMatch[1]);
								// Convert GB to MB if needed
								if (memoryMatch[2] && memoryMatch[2].toUpperCase() === 'GB') {
									memoryValue = parseInt(memoryValue * 1024);
								}
								else {
									memoryValue = parseInt(memoryValue);
								}
							}
						}

						let metrics = {
							timestamp: timestamp,
							app_guid: guid,
							service: svcName,
							ip: hostData.host,
							response_time: responseTime,
							player_count: svc.player_count || 0,
							status: svc.status === 'running' ? 1 : 0,
							memory_usage: memoryValue,
							cpu_usage: parseInt(svc.cpu_usage) || 0
						};

						try {
							await Metric.create(metrics);
						}
						catch(e) {
							logger.warn(`MetricsPollTask: Error saving metrics for service '${svcName}' on app '${guid}' at host '${hostData.host}':`, e.message);
						}
					}
				}
				catch(e){
					return reject(new Error(`Error parsing services metrics for application '${guid}' on host '${hostData.host}': ${e.message}`));
				}

				return resolve({
					app: appData,
					host: hostData,
					services: appServices,
					response_time: responseTime
				});
			})
			.catch(e => {
				return reject(new Error(`Error retrieving service metrics for application '${guid}' on host '${hostData.host}': ${e.error.message}`));
			});
	});
}
