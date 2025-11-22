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
			const cmd = `set -euo pipefail; ${data.host.path}/manage.py --backup`;
			logger.info(`Initiating backup for ${guid} on host ${host}`);

			cmdStreamer(host, cmd, res).catch(err => {
				logger.error('cmdStreamer error (backup):', err);
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


/**
 * PUT /api/application/backup/:guid/:host
 * Restore a named backup on the remote host. Expects req.body.filename (basename only).
 */
router.put('/:guid/:host', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host,
		filename = req.body && req.body.filename ? String(req.body.filename).trim() : '';

	if (!guid || !host) {
		return res.status(400).json({ success: false, error: 'Missing guid or host' });
	}

	if (!filename) {
		return res.status(400).json({ success: false, error: 'Missing filename' });
	}

	// Enforce basename-only policy: no slashes, only allow safe chars
	if (filename.indexOf('/') !== -1 || !/^[A-Za-z0-9._-]+$/.test(filename)) {
		return res.status(400).json({ success: false, error: 'Invalid filename; only a basename with [A-Za-z0-9._-] is allowed' });
	}

	validateHostApplication(host, guid).then(data => {
		try {
			// filename has been validated to be basename-only and not contain quotes
			const escapedFilename = data.host.path + '/backups/' + String(filename).replace(/"/g, '\\"');

			const cmd = `set -euo pipefail; ${data.host.path}/manage.py --restore "${escapedFilename}"`;
			logger.info(`Restoring backup ${filename} for ${guid} on host ${host}`);

			cmdStreamer(host, cmd, res).catch(err => {
				logger.error('cmdStreamer error (restore):', err);
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
