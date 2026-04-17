const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {logger} = require('../../libs/logger.mjs');
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");

const router = express.Router();

/**
 * Trigger a backup on the remote host. No filename required; manage.py will pick one.
 *
 * POST /api/application/backup/:guid/:host
 *
 * @property {AppInstallData} req.appInstallData
 */
router.post('/:guid/:host', validate_session, validateHostApplication, (req, res) => {
	const cmd = req.appInstallData.getCommandString('backup');

	cmdStreamer(req.appInstallData.host, cmd, res, true).catch(err => {
		logger.error('cmdStreamer error (backup):', err);
		// cmdStreamer will generally have written to the response, but ensure closed
		try { res.end(); } catch(e){}
	}).finally(() => {
		clearTaggedCache(req.appInstallData.host, 'files');
	});
});

/**
 * Trigger a backup on the remote host. No filename required; manage.py will pick one.
 *
 * POST /api/application/backup/:guid/:host/:service
 *
 * Runs on V2 of the API.
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.post('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	const cmd = req.appInstallData.getServiceCommandString('backup', req.serviceData.service);

	cmdStreamer(req.appInstallData.host, cmd, res, true).catch(err => {
		logger.error('cmdStreamer error (backup):', err);
		// cmdStreamer will generally have written to the response, but ensure closed
		try { res.end(); } catch(e){}
	}).finally(() => {
		clearTaggedCache(req.appInstallData.host, 'files');
	});
});


/**
 * Restore a named backup on the remote host. Expects req.body.filename (basename only).
 *
 * PUT /api/application/backup/:guid/:host
 *
 * @property {AppInstallData} req.appInstallData
 */
router.put('/:guid/:host', validate_session, validateHostApplication, (req, res) => {
	const filename = req.body && req.body.filename ? String(req.body.filename).trim() : '';

	if (!filename) {
		return res.status(400).json({ success: false, error: 'Missing filename' });
	}

	// Enforce basename-only policy: no slashes, only allow safe chars
	if (filename.indexOf('/') !== -1 || !/^[A-Za-z0-9._-]+$/.test(filename)) {
		return res.status(400).json({ success: false, error: 'Invalid filename; only a basename with [A-Za-z0-9._-] is allowed' });
	}

	// filename has been validated to be basename-only and not contain quotes
	const escapedFilename = req.appInstallData.path + '/backups/' + String(filename).replace(/"/g, '\\"');

	const cmd = req.appInstallData.getCommandString('restore', escapedFilename);

	cmdStreamer(req.appInstallData.host, cmd, res, true).catch(err => {
		logger.error('cmdStreamer error (restore):', err);
		try { res.end(); } catch(e){}
	});
});

/**
 * Restore a named backup on the remote host. Expects req.body.filename (basename only).
 *
 * PUT /api/application/backup/:guid/:host/:service
 *
 * Runs on V2 of the API.
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.put('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	const filename = req.body && req.body.filename ? String(req.body.filename).trim() : '';

	if (!filename) {
		return res.status(400).json({ success: false, error: 'Missing filename' });
	}

	// Enforce basename-only policy: no slashes, only allow safe chars
	if (filename.indexOf('/') !== -1 || !/^[A-Za-z0-9._-]+$/.test(filename)) {
		return res.status(400).json({
			success: false,
			error: 'Invalid filename; only a basename with [A-Za-z0-9._-] is allowed'
		});
	}

	const cmd = req.appInstallData.getServiceCommandString('restore', req.serviceData.service, filename);

	cmdStreamer(req.appInstallData.host, cmd, res, true).catch(err => {
		logger.error('cmdStreamer error (restore):', err);
		try { res.end(); } catch(e){}
	});
});

module.exports = router;
