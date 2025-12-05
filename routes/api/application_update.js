const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {logger} = require('../../libs/logger.mjs');

const router = express.Router();

/**
 * POST /api/application/backup/:guid/:host
 * Trigger a backup on the remote host. No filename required; manage.py will pick one.
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

			cmdStreamer(host, cmd, res).catch(err => {
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
