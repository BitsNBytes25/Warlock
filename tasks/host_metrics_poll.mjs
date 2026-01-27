import {logger} from "../libs/logger.mjs";
import {Host} from "../db.js";
import {getHostMetrics} from "../libs/get_host_metrics.mjs";

export function HostMetricsPollTask() {
	Host.findAll().then(hosts => {
		hosts.forEach(host => {
			getHostMetrics(host.ip).catch(error => {
				logger.error(`HostMetricsPollTask: Error retrieving metrics for host ${host.ip}:`, error.message);
			});
		});
	}).catch(error => {
		logger.error('HostMetricsPollTask: Error retrieving hosts:', error.message);
	});
}
