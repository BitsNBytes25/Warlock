import { getAllApplications } from './get_all_applications.mjs';
import {logger} from "./logger.mjs";
import { HostData } from './host_data.mjs';
import {BadRequestError, NotFoundError} from "./errors.mjs";

/**
 * Validate that a given host and application GUID exist on the system
 *
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {Function} next Express next function
 *
 * @returns {Promise<AppInstallData>}
 */
export async function validateHostApplication(req, res, next) {
	const { host, guid } = req.params;

	if (!guid) {
		throw new BadRequestError('Missing guid parameter');
	}
	if (!host) {
		throw new BadRequestError('Missing host parameter');
	}

	return getAllApplications()
		.then(async applications => {
			const app = applications.find(a => a.guid === guid);

			if (!app) {
				throw new NotFoundError(`Application with GUID '${guid}' not found`);
			}

			const appInstallData = app.installs.find(h => h.host === host);
			if (!appInstallData) {
				throw new NotFoundError(`Application with GUID '${guid}' not found on host '${host}'`);
			}

			// Load the host data for this lookup, used by many endpoints
			const hostData = new HostData(host);
			await hostData.init();

			// Attach the discovered data to the request object
			req.applicationData = app;
			req.appInstallData = appInstallData;
			req.hostData = hostData;
			// Attach the discovered data to the locals object of res so it's available in templates
			res.locals.applicationData = app;
			res.locals.appInstallData = appInstallData;
			res.locals.hostData = hostData;
			// Run next middleware function
			next();
		});
}
