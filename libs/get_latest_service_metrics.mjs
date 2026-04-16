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
		memory_usage: 0,
		cpu_usage: 0
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
			if (res.cpu_usage !== null) {
				metrics.cpu_usage = res.cpu_usage;
			}

			if (res.memory_usage !== null) {
				metrics.memory_usage = res.memory_usage;
			}

			metrics.status = res.status === 1 ? 'running' : 'stopped';

			if (res.player_count !== null) {
				metrics.player_count = res.player_count;
			}

			if (res.response_time !== null) {
				metrics.response_time = res.response_time + ' ms';
			}
		}

	return metrics;
}