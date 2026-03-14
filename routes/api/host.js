const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {diffObjects} = require("../../libs/diff_objects.mjs");
const {validateHost} = require("../../libs/validate_host.mjs");
const {setupEventStream} = require("../../libs/setup_event_stream.mjs");

const router = express.Router();

/**
 * API endpoint to get all enabled hosts and their general information
 *
 * API endpoint: GET /api/hosts
 */
router.get(
	'/:host',
	validate_session,
	validateHost,
	(req, res) => {
		return res.json({
			success: true,
			host: req.hostData
		});
	}
);

/**
 * API endpoint to get all metrics for enabled hosts
 *
 * API endpoint: GET /api/hosts
 */
router.get(
	'/metrics/:host',
	validate_session,
	validateHost,
	async (req, res) => {
		let metrics = await req.hostData.getMetrics();

		return res.json({
			success: true,
			metrics: metrics
		});
	}
);

/**
 * Stream "live" metrics and stats for a given service
 *
 * Only updates are sent to the client every 5 seconds.
 */
router.get(
	'/metrics/stream/:host',
	validate_session,
	validateHost,
	setupEventStream,
	(req, res) => {
		let host = req.hostData,
			data = {};

		const lookup = async (host) => {
			if (res.locals.clientGone) return;

			// Get the live metrics for this host
			let metrics = await host.getMetrics();

			if (res.locals.clientGone) return;
			const diffData = diffObjects(data, metrics);
			data = metrics;

			// Write a response if we have differences.
			if (Object.keys(diffData).length > 0) {
				// Ensure the resulting data contains the host ID, as this will support multiple hosts.
				diffData.host = host.host;
				res.write(`json: ${JSON.stringify(diffData)}\n\n`);
			}

			// Schedule the next lookup in 5 seconds
			setTimeout(lookup,5000, host);
		};

		// Build the initial set of data to use as a local cache.
		// Since we only want to send _changes_, we need to know what we've sent previously.
		data = {};
		lookup(host);
	}
);

module.exports = router;
