import { getAllApplications } from './get_all_applications.mjs';
import {logger} from "./logger.mjs";

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
		return res.status(400).json({ success: false, error: 'Missing guid' });
	}
	if (!host) {
		return res.status(400).json({ success: false, error: 'Missing host' });
	}
	if (!service) {
		return res.status(400).json({ success: false, error: 'Missing service' });
	}

	getAllApplications()
		.then(async applications => {
			const apps = applications.filter(a => a.guid === guid);
			const app = apps.length > 0 ? apps[0] : null;

			if (!app) {
				throw new Error(`Application with GUID '${guid}' not found`);
			}

			const appInstallData = app.installs.find(h => h.host === host);
			if (!appInstallData) {
				throw new Error(`Application '${guid}' not found on host '${host}'`);
			}

			const svc = await appInstallData.getService(service);
			if (!svc) {
				throw new Error(`Service '${service}' not found in application '${guid}' on host '${host}'`);
			}

			// Attach the discovered data to the request object
			req.appInstallData = appInstallData;
			req.serviceData = svc;
			// Attach the discovered data to the locals object of res so it's available in templates
			res.locals.appInstallData = appInstallData;
			res.locals.serviceData = svc;
			// Run next middleware function
			next();
		})
		.catch (e => {
			logger.error('validateHostService error:', e);
			res.status(400).json({ success: false, error: e.message });
		});
}
