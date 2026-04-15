const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {diffObjects} = require("../../libs/diff_objects.mjs");
const {validateHost} = require("../../libs/validate_host.mjs");
const {setupEventStream} = require("../../libs/setup_event_stream.mjs");
const path = require('path');
const { cmdRunner } = require("../../libs/cmd_runner.mjs");
const {filePushRunner} = require("../../libs/file_push_runner.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");

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

/**
 * API endpoint to register a given host with Warlock.Nexus
 *
 * API endpoint: POST /api/host/register/:host
 */
router.post(
	'/register/:host',
	validate_session,
	validateHost,
	async (req, res) => {
		const script = path.join(process.cwd(), 'scripts', 'nexus_register_host.sh');
		let {email, token} = req.body || '';

		if (email === undefined) {
			email = '';
		}
		if (token === undefined) {
			token = '';
		}

		if (!email) {
			return res.json({ success: false, error: 'Email is required' });
		}
		if (!token) {
			return res.json({ success: false, error: 'Token is required' });
		}

		function tryJSONParse(s) {
			// These messages generally are JSON encoded, (but not always if something goes wrong)
			// Get the message component
			try {
				return JSON.parse(s).message;
			}
			catch(e) {
				return s;
			}
		}

		if (req.hostData.host === 'localhost' || req.hostData.host === '127.0.0.1') {
			// Perform operations for localhost; they'll be slightly different than remote hosts.

			// Ensure file is executable; it should be already, but just check.
			await cmdRunner(req.hostData.host, 'chmod +x ' + script);

			// Run the script to install the appropriate firewall.
			cmdRunner(req.hostData.host, `${script} --email="${email}" --token="${token}"`).then(result => {
				// Clear the cache so the changed parameters are visible immediately.
				clearTaggedCache(req.hostData.host);
				return res.json({ success: true, message: tryJSONParse(result.stdout) });
			}).catch(e => {
				return res.json({ success: false, error: tryJSONParse(e.stderr) });
			});
		}
		else {
			const rScript = '/opt/warlock/linux_install_firewall.sh';
			// Ensure the target payload directory exists; we'll just use /opt/warlock to keep everything together.
			await cmdRunner(req.hostData.host, '[ -d /opt/warlock ] || mkdir -p /opt/warlock');

			// Perform the request on the remote host, but first we need to transfer the install script over there.
			await filePushRunner(req.hostData.host, script, rScript);

			// Now we can run the script
			cmdRunner(req.hostData.host, `chmod +x ${rScript} && ${rScript} --email="${email}" --token="${token}"`).then(result => {
				// Clear the cache so the changed parameters are visible immediately.
				clearTaggedCache(req.hostData.host);
				return res.json({ success: true, message: tryJSONParse(result.stdout) });
			}).catch(e => {
				return res.json({ success: false, error: tryJSONParse(e.stderr) });
			});
		}
	}
);

module.exports = router;
