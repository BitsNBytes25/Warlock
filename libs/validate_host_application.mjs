import { getAllApplications } from './get_all_applications.mjs';
import {logger} from "./logger.mjs";

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
		return res.status(400).json({ success: false, error: 'Missing guid' });
	}
	if (!host) {
		return res.status(400).json({ success: false, error: 'Missing host' });
	}

	getAllApplications()
		.then(applications => {
			const apps = applications.filter(a => a.guid === guid);
			const app = apps.length > 0 ? apps[0] : null;

			if (!app) {
				throw new Error(`Application with GUID '${guid}' not found`);
			}

			const appInstallData = app.installs.find(h => h.host === host);
			if (!appInstallData) {
				throw new Error(`Application '${guid}' not found on host '${host}'`);
			}

			// Attach the discovered data to the request object
			req.appInstallData = appInstallData;
			// Attach the discovered data to the locals object of res so it's available in templates
			res.locals.appInstallData = appInstallData;
			// Run next middleware function
			next();
		})
		.catch (e => {
			logger.error('validateHostApplication error:', e);
			res.status(400).json({ success: false, error: e.message });
		});
}
