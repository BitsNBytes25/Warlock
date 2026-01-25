const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {logger} = require('../../libs/logger.mjs');
const {cmdRunner} = require("../../libs/cmd_runner.mjs");

const router = express.Router();

/**
 * Check if this application has an update available
 */
router.get('/:guid/:host', validate_session, (req, res) => {

	const guid = req.params.guid,
		host = req.params.host;

	if (!guid || !host) {
		return res.status(400).json({ success: false, error: 'Missing guid or host' });
	}

	validateHostApplication(host, guid).then(data => {
		try {
			// data.host.path holds the installation directory for the app on the host
			const cmd = `${data.host.path}/manage.py --check-update`;
			logger.info(`Initiating update check for ${guid} on host ${host}`);

			cmdRunner(host, cmd)
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
		} catch (err) {
			return res.status(400).json({ success: false, error: err.message });
		}
	}).catch(e => {
		return res.status(400).json({ success: false, error: e.message });
	});
});

/**
 * POST /api/application/update/:guid/:host
 * Trigger an application update/installation on the remote host.
 */
router.post('/:guid/:host', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host;

	if (!guid || !host) {
		return res.status(400).json({ success: false, error: 'Missing guid or host' });
	}

	validateHostApplication(host, guid).then(data => {
		try {
			// data.host.path holds the installation directory for the app on the host
			const cmd = `${data.host.path}/manage.py --update`;
			logger.info(`Initiating update for ${guid} on host ${host}`);

			cmdStreamer(host, cmd, res, true).catch(err => {
				logger.error('cmdStreamer error (update):', err);
				// cmdStreamer will generally have written to the response, but ensure closed
				try { res.end(); } catch(e){}
			});

		} catch (err) {
			return res.status(400).json({ success: false, error: err.message });
		}
	}).catch(e => {
		return res.status(400).json({ success: false, error: e.message });
	});
});

module.exports = router;
