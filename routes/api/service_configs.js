const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const cache = require("../../libs/cache.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");

const router = express.Router();

/**
 * Get the configuration values and settings for a given service
 *
 * API endpoint: GET /api/service/configs/:guid/:host/:service
 *
 * Returns JSON data with success (True/False) and configs [{Object}]
 * Each config contains:
 * - option: The name of the config
 * - value: The value of the config
 * - default: The default value of the config
 * - type: The type of the config (string, int, bool, etc.)
 * - help: A description of the config
 * - options: List of values available for this config (if applicable)
 * - group: Display group for this config (if applicable)
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.get('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	cmdRunner(req.appInstallData.host, req.appInstallData.getServiceCommandString('get-configs', req.serviceData.service))
		.then(result => {
			return res.json({
				success: true,
				configs: JSON.parse(result.stdout)
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.error.message
			});
		});
});

/**
 * Update the configuration values for a given service
 *
 * API endpoint: POST /api/service/configs/:guid/:host/:service
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.post('/:guid/:host/:service', validate_session, validateHostService, async (req, res) => {
	const configUpdates = req.body;

	// Multiple updates can be sent in a single request, but run them one-at-a-time.
	let errors = '';
	for (let option in configUpdates) {
		const value = configUpdates[option];
		try {
			await cmdRunner(req.appInstallData.host, req.appInstallData.getServiceCommandString('set-config', req.serviceData.service, option, value));
		}
		catch (e) {
			errors += e.error.message + '\n';
		}
	}

	// Clear the cache data for this service, useful for keys like name or port.
	clearTaggedCache(req.appInstallData.host, req.appInstallData.guid);

	if (errors) {
		return res.json({
			success: false,
			error: errors
		});
	}
	else {
		return res.json({
			success: true,
		});
	}
});

module.exports = router;
