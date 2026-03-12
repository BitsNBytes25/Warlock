import {Host} from "../db.js";
import {HostData} from "./host_data.mjs";

/**
 * Lookup and inject all hosts data into the Express res.locals object
 *
 * Populates res.locals.hosts with an array of HostData objects
 *
 * @param req
 * @param res
 * @param next
 * @returns {Promise<void>}
 */
export async function injectHosts(req, res, next) {
	Host.findAll().then(async hosts => {
		let promises = [],
			result = [];
		hosts.forEach(host => {
			const hostData = new HostData(host.ip);
			result.push(hostData);
			promises.push(hostData.init());
		});

		await Promise.allSettled(promises);

		res.locals.hosts = result;
		next();
	});
}
