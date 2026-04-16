import {getAllApplications} from "../libs/get_all_applications.mjs";
import {logger} from "../libs/logger.mjs";
import {getApplicationMetrics} from "../libs/get_application_metrics.mjs";

export function MetricsPollTask() {
	getAllApplications()
		.then(results => {
			let allLookups = [];

			results.forEach(app => {
				for (let hostData of app.installs) {
					allLookups.push(getApplicationMetrics(hostData));
				}
			});

			Promise.allSettled(allLookups)
				.then(() => {
					logger.debug('All lookups completed');
				});
		})
		.catch(e => {
			logger.warn('MetricsPollTask: Error polling metrics:', e.message);
		});
}