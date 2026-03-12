const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {logger} = require('../../libs/logger.mjs');
const {cmdRunner} = require("../../libs/cmd_runner.mjs");

const router = express.Router();

/**
 * Check if this application has an update available
 *
 * API endpoint: GET /api/application/update/:guid/:host
 *
 * Returns JSON data with success (True/False), updates (True/False), and message (string)
 *
 * @property {AppInstallData} req.appInstallData
 */
router.get('/:guid/:host', validate_session, validateHostApplication, (req, res) => {
	const cmd = req.appInstallData.getCommandString('check-update');

	cmdRunner(req.appInstallData.host, cmd)
		.then(output => {
			return res.json({
				success: true,
				updates: true,
				message: output.stdout || 'Updates available'
			});
		})
		.catch(err => {
			// An error, (ie a non-zero exit code), usually indicate no updates available
			return res.json({
				success: true,
				updates: false,
				message: err.stdout || 'No updates available'
			});
		});
});

/**
 * Trigger an application update/installation on the remote host.
 *
 * API endpoint: POST /api/application/update/:guid/:host
 *
 * @property {AppInstallData} req.appInstallData
 */
router.post('/:guid/:host', validate_session, validateHostApplication, (req, res) => {
	const cmd = req.appInstallData.getCommandString('update');

	cmdStreamer(req.appInstallData.host, cmd, res, true).catch(err => {
		logger.error('cmdStreamer error (update):', err);
		// cmdStreamer will generally have written to the response, but ensure closed
		try { res.end(); } catch(e){}
	});
});

module.exports = router;
