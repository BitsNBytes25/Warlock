import {Host} from "../db.js";
import {HostData} from "./host_data.mjs";
import {getAllApplications} from "./get_all_applications.mjs";

/**
 * Lookup and inject installed application data into the Express res.locals object
 *
 * Populates res.locals.apps with an array of AppData objects
 *
 * @param req
 * @param res
 * @param next
 * @returns {Promise<void>}
 */
export async function injectApps(req, res, next) {
	return getAllApplications()
		.then(applications => {
			// Limit to only installed applications
			applications = applications.filter(app => app.installs.length > 0);

			res.locals.apps = applications;
			next();
		});
}
