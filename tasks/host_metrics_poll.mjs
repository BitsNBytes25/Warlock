import {logger} from "../libs/logger.mjs";
import {Host} from "../db.js";
import {HostData} from "../libs/host_data.mjs";

export function HostMetricsPollTask() {
	Host.findAll().then(hosts => {
		hosts.forEach(host => {
			let hostData = new HostData(host.ip);
			hostData.getMetrics().catch(error => {
				logger.error(`HostMetricsPollTask: Error retrieving metrics for host ${host.ip}:`, error.message);
			});
		});
	}).catch(error => {
		logger.error('HostMetricsPollTask: Error retrieving hosts:', error.message);
	});
}
