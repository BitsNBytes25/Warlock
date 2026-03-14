const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
const { logger } = require('../../libs/logger.mjs');
const {validateHost} = require("../../libs/validate_host.mjs");
const {Cron} = require("../../libs/cron.mjs");
const router = express.Router();

/**
 * Get the cron entries for a given host
 *
 * API endpoint: GET /api/cron/:host
 *
 * Returns JSON with success (True/False) and jobs.
 * Each job is an object with the following properties:
 * - raw: The raw crontab line
 * - is_comment: True if the line is a comment
 * - schedule: The cron schedule (or null if not a cron line)
 * - command: The command to run (or null if not a cron line)
 * - identifier: The identifier for the job (or null if not a cron line)
 * - is_warlock: True if the line is a Warlock-specific line (e.g. #warlock:id=...)
 */
router.get(
	'/:host',
	validate_session,
	validateHost,
	async (req, res) => {
		const host = req.hostData.host;

		try {
			let jobs = await Cron.GetAll(host);
			return res.json({ success: true, jobs: jobs });
		}
		catch (e) {
			logger.error('Error reading crontab:', e);
			return res.json({ success: false, error: e && e.error ? e.error.message || String(e.error) : String(e) });
		}
	}
);

// POST /api/cron/:host - add or update a job
router.post(
	'/:host',
	validate_session,
	validateHost,
	async (req, res) => {
		const host = req.hostData.host;
		const {schedule, command, identifier} = req.body || {};

		try {
			const cron = new Cron(host, identifier, command, schedule);
			const result = await cron.save();
			if (result.success) {
				return res.json({success: true, message: result.message});
			} else {
				return res.json({success: false, error: result.message});
			}
		} catch (e) {
			return res.json({success: false, error: e.message});
		}
	}
);

// DELETE /api/cron/:host - remove a job by identifier (required)
router.delete(
	'/:host',
	validate_session,
	validateHost,
	async (req, res) => {
		const host = req.hostData.host;
		const { identifier } = req.body || {};

		try {
			const cron = await Cron.FindByIdentifier(host, identifier);
			if (!cron) {
				return res.json({success: false, error: 'No cron job found with the specified identifier'});
			}

			const result = await cron.delete();
			if (result.success) {
				return res.json({success: true, message: result.message});
			} else {
				return res.json({success: false, error: result.message});
			}
		} catch (e) {
			return res.json({success: false, error: e.message});
		}
	}
);

module.exports = router;

