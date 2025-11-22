const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {clearCache} = require("../../libs/cache.mjs");

const router = express.Router();

// Service control endpoint (start/stop/restart) - now works with all applications dynamically
router.post('/:guid/:host/:service', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host,
		service = req.params.service;
	const { action } = req.body;

	if (!(host && guid && service && action)) {
		return res.json({
			success: false,
			error: 'Host, service, and action are required'
		});
	}

	const validActions = ['start', 'stop', 'restart', 'enable', 'disable'];
	if (!validActions.includes(action)) {
		return res.json({
			success: false,
			error: `Invalid action. Must be one of: ${validActions.join(', ')}`
		});
	}

	validateHostService(host, guid, service)
		.then(dat => {
			cmdRunner(host, `systemctl ${action} ${service}`)
				.then(result => {
					clearCache();
					return res.json({
						success: true,
						output: result.stdout,
						stderr: result.stderr
					});
				})
				.catch(e => {
					return res.json({
						success: false,
						error: e.error.message
					});
				});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.message
			});
		});
});

module.exports = router;
