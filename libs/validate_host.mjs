import {Host} from '../db.js';
import {HostData} from './host_data.mjs';

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
		return res.status(400).json({ success: false, error: 'Missing host' });
	}

	let count = await Host.count({ where: { ip: host } });
	if (count === 0) {
		return res.status(404).json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
	}

	const hostData = new HostData(host);
	await hostData.init();

	// Attach the discovered data to the request object
	req.hostData = hostData;
	// Attach the discovered data to the locals object of res so it's available in templates
	res.locals.hostData = hostData;
	// Run next middleware function
	next();
}
