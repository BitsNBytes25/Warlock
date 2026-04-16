const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");

const router = express.Router();

/**
 * Get a list of raw commands for a service
 *
 * API endpoint: GET /api/service/cmd/:guid/:host/:service
 *
 * Returns JSON data with success (True/False) and commands [{string}]
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.get('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	// Check if the application supports the 'cmd' option
	if (!req.appInstallData.options.includes('get-commands')) {
		return res.json({
			success: false,
			error: 'This application does not support raw command execution'
		});
	}

	// Execute the command via manage.py
	const cmd = req.appInstallData.getServiceCommandString('get-commands', req.serviceData.service);
	cmdRunner(req.appInstallData.host, cmd, 86400)
		.then(output => {
			let commands = JSON.parse(output.stdout);
			res.json({
				success: true,
				commands: commands
			});
		})
		.catch(e => {
			res.json({
				success: false,
				error: e.error ? e.error.message : e.message
			});
		});
});

/**
 * Send a raw command to a service
 *
 * API endpoint: POST /api/service/cmd/:guid/:host/:service
 *
 * Requires a JSON body with the following properties:
 * - command: The command to execute
 *
 * Returns JSON data with success (True/False) and output (string)
 *
 * Note, not all games will return output; some may need polling of the logs to get output.
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.post('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	const {command} = req.body;

	if (!command || typeof command !== 'string') {
		return res.json({
			success: false,
			error: 'Command is required and must be a string'
		});
	}

	// Check if the application supports the 'cmd' option
	if (!req.appInstallData.options.includes('cmd')) {
		return res.json({
			success: false,
			error: 'This application does not support raw command execution'
		});
	}

	// Execute the command via manage.py
	const cmd = req.appInstallData.getServiceCommandString('cmd', req.serviceData.service, '"' + command.replace(/"/g, '\\"') + '"');
	cmdRunner(req.appInstallData.host, cmd)
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
});

module.exports = router;
