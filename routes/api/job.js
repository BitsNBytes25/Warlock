const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {activeJobs} = require("../../libs/active_jobs.mjs");

const router = express.Router();


/**
 * API endpoint to PUSH text to a running job
 *
 * API endpoint: POST /api/job/:job
 */
router.post(
	'/:job',
	validate_session,
	async (req, res) => {
		const { job } = req.params;
		const { text } = req.body;

		// Retrieve the active child process reference
		const child = activeJobs.get(job);

		if (!child) {
			return res.status(404).json({ success: false, error: 'Job not found or already finished.' });
		}

		try {
			// Write the data payload to the child process stdin stream
			// Note: Newline (\n) is typically required to simulate the "Enter" key press
			child.stdin.write(`${text}\n`);

			return res.status(200).json({ success: true, message: 'input_sent' });
		} catch (error) {
			return res.status(500).json({ success: false, error: 'Failed to write to process stream.', details: error.message });
		}
	}
);

/**
 * API endpoint to cancel a running job
 *
 * API endpoint: DELETE /api/job/:job
 */
router.delete('/:job', validate_session, async (req, res) => {
	const { job } = req.params;
	const child = activeJobs.get(job);

	if (!child) {
		return res.status(200).json({ success: true, message: 'Job already finished.' });
	}

	try {
		child.kill('SIGTERM');

		return res.status(200).json({ success: true, message: 'sigterm sent' });
	} catch (error) {
		return res.status(500).json({ success: false, error: 'Failed to kill process.', details: error.message });
	}
});

module.exports = router;
