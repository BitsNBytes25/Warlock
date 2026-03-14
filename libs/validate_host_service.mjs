import { getAllApplications } from './get_all_applications.mjs';
import {logger} from "./logger.mjs";
import { HostData } from './host_data.mjs';
import {BadRequestError, NotFoundError} from "./errors.mjs";

/**
 * Validate that a given host, application GUID, and service name exist and are properly associated.
 *
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {Function} next Express next function
 *
 * @returns {Promise<Object.<host: AppInstallData, service: ServiceData>>}
 */
export async function validateHostService(req, res, next) {
	const { host, guid, service } = req.params;

	if (!guid) {
		throw new BadRequestError('Missing guid parameter');
	}
	if (!host) {
		throw new BadRequestError('Missing host parameter');
	}
	if (!service) {
		throw new BadRequestError('Missing service parameter');
	}

	return getAllApplications()
		.then(async applications => {
			const apps = applications.filter(a => a.guid === guid);
			const app = apps.length > 0 ? apps[0] : null;

			if (!app) {
				throw new NotFoundError(`Application with GUID '${guid}' not found`);
			}

			// Load the host data for this lookup, used by many endpoints
			const hostData = new HostData(host);
			await hostData.init();

			const appInstallData = app.installs.find(h => h.host === host);
			if (!appInstallData) {
				throw new NotFoundError(`Application '${guid}' not installed on host '${host}'`);
			}

			const svc = await appInstallData.getService(service);
			if (!svc) {
				throw new NotFoundError(`Service '${service}' not found in application '${guid}' on host '${host}'`);
			}

			// Attach the discovered data to the request object
			req.applicationData = app;
			req.appInstallData = appInstallData;
			req.serviceData = svc;
			req.hostData = hostData;

			// Attach the discovered data to the locals object of res so it's available in templates
			res.locals.applicationData = app;
			res.locals.appInstallData = appInstallData;
			res.locals.serviceData = svc;
			res.locals.hostData = hostData;
			// Run next middleware function
			next();
		});
}
