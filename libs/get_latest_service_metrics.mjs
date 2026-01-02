import {Metric} from "../db.js";

/**
 * Get the latest metrics for a given service on a host
 *
 * The return dictionary will be similar to that of querying `--get-metrics` for the service
 *
 * @param {string} app_guid
 * @param {string} host
 * @param {string} service
 * @returns {Promise<{response_time: string, player_count: number, status: string, memory: string, cpu: string}>}
 */
export async function getLatestServiceMetrics(app_guid, host, service) {
	let metrics = {
		response_time: 'N/A',
		player_count: 0,
		status: 'Unknown',
		memory_usage: 'N/A',
		cpu_usage: 'N/A'
	};

		let res = await Metric.findOne({
			where: {
				ip: host,
				app_guid,
				service
			},
			order: [['timestamp', 'DESC']],
			raw: true
		});

		if (res) {
			
				metrics.cpu_usage = res.cpu_usage + '%';
			
				if (res.memory_usage > 1024) {
					metrics.memory_usage = (res.memory_usage / 1024).toFixed(2) + ' GB';
				}
				else {
					metrics.memory_usage = res.memory_usage + ' MB';
				}
			
				metrics.status = res.status === 1 ? 'running' : 'stopped';
				metrics.player_count = res.player_count;
				metrics.response_time = res.response_time + ' ms';
							
		}

	return metrics;
}