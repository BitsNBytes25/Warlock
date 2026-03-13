const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {injectHosts} = require("../../libs/inject_hosts.mjs");
const {diffObjects} = require("../../libs/diff_objects.mjs");

const router = express.Router();

/**
 * API endpoint to get all enabled hosts and their general information
 *
 * API endpoint: GET /api/hosts
 */
router.get(
	'/',
	validate_session,
	injectHosts,
	(req, res) => {
		return res.json({
			success: true,
			hosts: res.locals.hosts
		});
	}
);

/**
 * API endpoint to get all metrics for enabled hosts
 *
 * API endpoint: GET /api/hosts
 */
router.get(
	'/metrics',
	validate_session,
	injectHosts,
	async (req, res) => {
		let metrics = [];
		for (let host of res.locals.hosts) {
			let m = await host.getMetrics();
			metrics.push(m);
		}

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
	'/metrics/stream',
	validate_session,
	injectHosts,
	(req, res) => {
		let clientGone = false,
			hosts = res.locals.hosts,
			lastDataSent = Date.now(),
			data = {};

		res.writeHead(200, {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive'
		});

		const onClientClose = () => {
			if (clientGone) return;
			clientGone = true;
		};

		const lookup = async (host) => {
			if (clientGone) return;

			// Get the live metrics for this host
			let metrics = await host.getMetrics();

			if (clientGone) return;
			const diffData = diffObjects(data[host.host], metrics);
			data[host.host] = metrics;

			// Write a response if we have differences.
			if (Object.keys(diffData).length > 0) {
				// Ensure the resulting data contains the host ID, as this will support multiple hosts.
				diffData.host = host.host;
				res.write(`json: ${JSON.stringify(diffData)}\n\n`);
				lastDataSent = Date.now();
			}
			else if (Date.now() - lastDataSent > 60000) {
				res.write(':keepalive\n\n');
				lastDataSent = Date.now();
			}

			// Schedule the next lookup in 5 seconds
			setTimeout(lookup,5000, host);
		};

		// Track client disconnects
		req.on('close', onClientClose);
		req.on('aborted', onClientClose);
		res.on('close', onClientClose);

		// Build the initial set of data to use as a local cache.
		// Since we only want to send _changes_, we need to know what we've sent previously.
		for(let host of hosts) {
			data[host.host] = {};
			lookup(host);
		}
	}
);

module.exports = router;
