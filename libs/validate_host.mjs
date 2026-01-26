import {Host} from '../db.js';

/**
 * Validate that a host exists in the database
 *
 * @param {string} host - Host IP or hostname
 * @returns {Promise<{ip: string}>}
 */
export async function validateHost(host) {
	return new Promise((resolve, reject) => {
		Host.findOne({ where: { ip: host } })
			.then(hostRecord => {
				if (!hostRecord) {
					return reject(new Error(`Host '${host}' not found in database`));
				}
				resolve({ ip: hostRecord.ip });
			})
			.catch(e => {
				return reject(new Error(`Error validating host: ${e.message}`));
			});
	});
}

