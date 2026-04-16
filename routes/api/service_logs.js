const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");

const router = express.Router();

/**
 * Get recent logs for a given service
 *
 * API endpoint: GET /api/service/logs/:guid/:host/:service
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.get('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	const mode = req.query.mode || 'live',
		offset = parseInt(req.query.offset) || 1;

	if (mode === 'live') {
		// User requested a live real-time view of logs
		// Use the cmdStreamer to stream output straight to the browser.
		cmdStreamer(req.appInstallData.host, `journalctl -qfu ${req.serviceData.service}.service --no-pager`, res);
	}
	else if (mode === 'd' || mode === 'h') {
		// User requested a static view of recent logs
		const cmd = `journalctl -qu ${req.serviceData.service}.service --no-pager -S -${offset}${mode} -U -${offset-1}${mode}`;
		cmdRunner(req.appInstallData.host, cmd)
			.then(output => {
				res.send(output.stdout);
			})
			.catch(e => {
				res.status(400).send(`Could not retrieve service logs: ${e.error.message}`);
			});
	}
	else {
		res.status(400).send(`Invalid mode specified: ${mode}`);
	}
});

module.exports = router;
