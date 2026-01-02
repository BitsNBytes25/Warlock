import {getAllApplications} from "../libs/get_all_applications.mjs";
import {Metric} from "../db.js";
import {getAllServices} from "../libs/get_all_services.mjs";
import {getApplicationServices} from "../libs/get_application_services.mjs";
import {logger} from "../libs/logger.mjs";
import {getApplicationMetrics} from "../libs/get_application_metrics.mjs";

export function MetricsPollTask() {
	getAllApplications()
		.then(results => {
			let allLookups = [];

			for (let guid in results) {
				let app = results[guid];
				for (let hostData of app.hosts) {
					allLookups.push(getApplicationMetrics(app, hostData));
				}
			}

			Promise.allSettled(allLookups)
				.then(serviceMetrics => {
					const timestamp = Math.floor(Date.now() / 1000);

					serviceMetrics.forEach(result => {
						if (result.status === 'fulfilled') {
							let appServices = result.value.services;
							for (let svc of Object.values(appServices)) {

								// Parse memory usage - handle MB and GB
								let memoryValue = 0;
								if (svc.memory_usage && svc.memory_usage !== 'N/A') {
									const memoryMatch = svc.memory_usage.match(/^([\d.]+)\s*(MB|GB)?/i);
									if (memoryMatch) {
										memoryValue = parseFloat(memoryMatch[1]);
										// Convert GB to MB if needed
										if (memoryMatch[2] && memoryMatch[2].toUpperCase() === 'GB') {
											memoryValue = memoryValue * 1024;
										}
									}
								}

								let metrics = {
									timestamp: timestamp,
									app_guid: result.value.app.guid,
									service: svc.service,
									ip: result.value.host.host,
									response_time: result.value.response_time,
									player_count: svc.player_count || 0,
									status: svc.status === 'running' ? 1 : 0,
									memory_usage: memoryValue,
									cpu_usage: parseFloat(svc.cpu_usage) || 0
								};

								Metric.create(metrics).catch(e => {
									logger.warn(`MetricsPollTask: Error saving metrics for service '${svc.service}' on app '${result.value.app.guid}' at host '${result.value.host.host}':`, e.message);
								});
							}
						}
					});
				});
		})
		.catch(e => {
			logger.warn('MetricsPollTask: Error polling metrics:', e.message);
		});
}