const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const cache = require("../../libs/cache.mjs");

const router = express.Router();

/**
 * Get the configuration values and settings for a given service
 */
router.get('/:guid/:host/:service', validate_session, (req, res) => {
	validateHostService(req.params.host, req.params.guid, req.params.service)
		.then(dat => {
			cmdRunner(dat.host.host, `${dat.host.path}/manage.py --service ${dat.service.service} --get-configs`)
				.then(result => {
					return res.json({
						success: true,
						configs: JSON.parse(result.stdout)
					});
				})
				.catch(e => {
					return res.json({
						success: false,
						error: e.error.message,
						service: []
					});
				});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.message,
				service: []
			});
		});
});

router.post('/:guid/:host/:service', async (req, res) => {
	const host = req.params.host,
		guid = req.params.guid,
		service = req.params.service;

	validateHostService(host, guid, service)
		.then(dat => {
			const configUpdates = req.body;
			const updatePromises = [];
			for (let option in configUpdates) {
				const value = configUpdates[option];
				updatePromises.push(
					cmdRunner(dat.host.host, `${dat.host.path}/manage.py --service ${dat.service.service} --set-config "${option}" "${value}"`)
				);
			}
			Promise.all(updatePromises)
				.then(result => {

					// Clear the cache data for this service, useful for keys like name or port.
					cache.default.set(`services_${guid}_${host}`, null, 1); // Invalidate cache

					return res.json({
						success: true,
					});
				})
				.catch(e => {
					return res.json({
						success: false,
						error: e.error.message
					});
				});
		});
});

module.exports = router;
