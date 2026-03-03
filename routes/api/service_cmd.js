const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");

const router = express.Router();

/**
 * Get a list of raw commands for a service
 */
router.get('/:guid/:host/:service', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host,
		service = req.params.service;

	validateHostService(host, guid, service)
		.then(dat => {
			// Check if the application supports the 'cmd' option
			if (!dat.host.options || !dat.host.options.includes('get-commands')) {
				return res.json({
					success: false,
					error: 'This application does not support raw command execution'
				});
			}

			// Execute the command via manage.py
			const cmd = dat.host.getServiceCommandString('get-commands', service);
			cmdRunner(host, cmd, {}, 86400)
				.then(output => {
					res.json({
						success: true,
						output: output.stdout
					});
				})
				.catch(e => {
					res.json({
						success: false,
						error: e.error ? e.error.message : e.message
					});
				});
		})
		.catch(e => {
			res.json({
				success: false,
				error: e.message
			});
		});
});

/**
 * Send a raw command to a service
 */
router.post('/:guid/:host/:service', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host,
		service = req.params.service,
		{command} = req.body;

	if (!command || typeof command !== 'string') {
		return res.json({
			success: false,
			error: 'Command is required and must be a string'
		});
	}

	validateHostService(host, guid, service)
		.then(dat => {
			// Check if the application supports the 'cmd' option
			if (!dat.host.options || !dat.host.options.includes('cmd')) {
				return res.json({
					success: false,
					error: 'This application does not support raw command execution'
				});
			}

			// Execute the command via manage.py
			const cmd = dat.host.getServiceCommandString('cmd', service, '"' + command.replace(/"/g, '\\"') + '"');
			cmdRunner(host, cmd)
				.then(output => {
					res.json({
						success: true,
						output: output.stdout
					});
				})
				.catch(e => {
					res.json({
						success: false,
						error: e.error ? e.error.message : e.message
					});
				});
		})
		.catch(e => {
			res.json({
				success: false,
				error: e.message
			});
		});
});

module.exports = router;
