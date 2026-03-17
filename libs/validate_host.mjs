import {Host} from '../db.js';
import {HostData} from './host_data.mjs';
import {BadRequestError, NotFoundError} from "./errors.mjs";

/**
 * Validate that a given host exists on the system
 *
 * Sets req.hostData and res.locals.hostData as the discovered HostData object
 *
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {Function} next Express next function
 */
export async function validateHost(req, res, next) {
	const { host } = req.params;

	if (!host) {
		throw new BadRequestError('Missing host parameter');
	}

	let count = await Host.count({ where: { ip: host } });
	if (count === 0) {
		throw new NotFoundError('Requested host is not registered in Warlock');
	}

	const hostData = new HostData(host);
	try {
		await hostData.init();
	}
	catch (e) {
		// A failed initialization does not mean it's a bad request; probably just means the host is not available.
	}


	// Attach the discovered data to the request object
	req.hostData = hostData;
	// Attach the discovered data to the locals object of res so it's available in templates
	res.locals.hostData = hostData;
	// Run next middleware function
	next();
}
