const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");

const router = express.Router();

/**
 * Get the configuration values and settings for a given application
 */
router.get('/:guid/:host', validate_session, (req, res) => {
	validateHostApplication(req.params.host, req.params.guid)
		.then(dat => {
			cmdRunner(dat.host.host, `${dat.host.path}/manage.py --get-configs`)
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

router.post('/:guid/:host', async (req, res) => {
	validateHostApplication(req.params.host, req.params.guid)
		.then(dat => {
			const configUpdates = req.body;
			const updatePromises = [];
			for (let option in configUpdates) {
				const value = configUpdates[option];
				updatePromises.push(
					cmdRunner(dat.host.host, `${dat.host.path}/manage.py --set-config "${option}" "${value}"`)
				);
			}
			Promise.all(updatePromises)
				.then(result => {
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
