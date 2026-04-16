import { getAllApplications } from './get_all_applications.mjs';
import {logger} from "./logger.mjs";
import { HostData } from './host_data.mjs';
import {BadRequestError, NotFoundError} from "./errors.mjs";

/**
 * Validate that an application GUID exists on the system
 *
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {Function} next Express next function
 *
 */
export async function validateApplication(req, res, next) {
	const { guid } = req.params;

	if (!guid) {
		throw new BadRequestError('Missing GUID in request URL');
	}

	return getAllApplications()
		.then(async applications => {
			const app = applications.find(a => a.guid === guid);

			if (!app) {
				throw new NotFoundError(`Application with GUID '${guid}' not found`);
			}

			// Attach the discovered data to the request object
			req.applicationData = app;
			// Attach the discovered data to the locals object of res so it's available in templates
			res.locals.applicationData = app;
			// Run next middleware function
			next();
		});
}
