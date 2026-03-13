import {cmdRunner} from "./cmd_runner.mjs";
import {Metric} from "../db.js";
import {logger} from "./logger.mjs";
import cache from "./cache.mjs";

/**
 * Get the metrics of an application on a given host
 *
 * Optionally include the service name to only retrieve metrics for that service
 *
 * @param hostData {AppInstallData}
 * @param service {string|null}
 * @returns {Promise<{services:Object.<{string}, ServiceData>, response_time:number}>}
 */
export async function getApplicationMetrics(hostData, service = null) {
	return new Promise((resolve, reject) => {

		const guid = hostData.guid,
			requestStartTime = Date.now();
		let cmd;

		if (hostData.options.includes('get-metrics')) {
			// Application supports service-level metrics collection
			if (service) {
				cmd = hostData.getServiceCommandString('get-metrics', service);
			}
			else {
				cmd = hostData.getCommandString('get-metrics');
			}
		}
		else {
			// Fallback to general status of all services
			cmd = hostData.getCommandString('get-services');
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
						// Remove some keys which are now unused
						delete svc.start_exec;
						delete svc.pre_exec;

						const timestamp = Math.floor(Date.now() / 1000);

						// Parse memory usage - handle MB and GB
						let memoryValue = 0;
						if (svc.memory_usage && svc.memory_usage !== 'N/A' && typeof(svc.memory_usage) === 'string') {
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
						svc.memory_usage = memoryValue;

						// Parse CPU usage; usually contains '%', but sometimes is 'N/A'.
						let cpuValue = 0;
						if (svc.cpu_usage && svc.cpu_usage !== 'N/A' && typeof(svc.cpu_usage) === 'string') {
							cpuValue = parseFloat(svc.cpu_usage.replace('%', ''));
						}
						else if (svc.cpu_usage && svc.cpu_usage !== 'N/A') {
							cpuValue = parseInt(svc.cpu_usage);
						}
						svc.cpu_usage = cpuValue;

						try {
							// Get the last metric for this service, and only record if at least a minute old.
							let lastMetric = await Metric.findOne({
								where: {
									ip: hostData.host,
									app_guid: guid,
									service: svcName
								},
								order: [['timestamp', 'DESC']],
								raw: true
							});
							if (lastMetric && (timestamp - lastMetric.timestamp) >= 60) {
								await Metric.create({
									timestamp: timestamp,
									app_guid: guid,
									service: svcName,
									ip: hostData.host,
									response_time: responseTime,
									player_count: svc.player_count || 0,
									status: svc.status === 'running' ? 1 : 0,
									memory_usage: memoryValue,
									cpu_usage: cpuValue
								});
							}
						}
						catch(e) {
							logger.warn(`getApplicationMetrics: Error saving metrics for service '${svcName}' on app '${guid}' at host '${hostData.host}':`, e.message);
						}

						if (typeof(svc.players) !== 'undefined') {
							cache.set(`players_${guid}_${hostData.host}_${svcName}`, svc.players, 5 * 60); // Cache for 5 minutes
						}
					}
				}
				catch(e){
					logger.warn(`getApplicationMetrics: Error parsing services metrics for application '${guid}' on host '${hostData.host}':`, e.message);
					return reject(new Error(`Error parsing services metrics for application '${guid}' on host '${hostData.host}': ${e.message}`));
				}

				return resolve({
					services: appServices,
					response_time: responseTime
				});
			})
			.catch(e => {
				return reject(new Error(`Error retrieving service metrics for application '${guid}' on host '${hostData.host}': ${e.error.message}`));
			});
	});
}
