const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {getAppInstaller} = require("../../libs/get_app_installer.mjs");
const {logger} = require("../../libs/logger.mjs");
const {Host} = require("../../db");
const {getAllApplications} = require("../../libs/get_all_applications.mjs");
const {clearCache} = require("../../libs/cache.mjs");

const router = express.Router();

/**
 * POST /api/application/install
 * Streams SSH output back to the client in real-time as text/event-stream (SSE-like chunks)
 * Route: POST /api/application/install/:guid/:host
 */
router.post('/:guid/:host', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host,
		options = req.body.options || {};

	if (!guid || !host) {
		return res.status(400).json({ success: false, error: 'Missing guid or host' });
	}

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}

		getAllApplications().then(async applications => {
			const appData = applications[guid] || null;

			if (!appData) {
				return res.json({
					success: false,
					error: `Application with GUID '${guid}' not found`
				});
			}

			try {
				// data.app should be an AppData object
				const url = await getAppInstaller(appData);
				if (!url) {
					// No installer URL available
					return res.status(400).json({
						success: false,
						error: 'No installer URL found for application ' + guid
					});
				}

				// Safely escape any single quotes in the URL for embedding in single-quoted shell literals
				const escapedUrl = String(url).replace(/'/g, "'\\''");

				let cliFlags = '--non-interactive';
				// Append any additional options as CLI flags
				options.forEach(option => {
					// Simple validation to avoid injection
					if (/^[a-zA-Z0-9_\-+=\/\.]+$/.test(option)) {
						if (option.includes('=')) {
							const [key, value] = option.split('=');
							cliFlags += ` ${key}="${value.replace(/"/g, '\\"')}"`;
						} else {
							cliFlags += ` ${option}`;
						}
					}
				});

				logger.info(`Installing ${appData.title} on host ${host} with flags ${cliFlags}`);

				// Build a command that streams the installer directly into bash to avoid writing to /tmp
				// It prefers curl, falls back to wget, and prints a clear error if neither is available.
				const cmd = `set -euo pipefail; ` +
					`if command -v curl >/dev/null 2>&1; then curl -fsSL '${escapedUrl}'; ` +
					`elif command -v wget >/dev/null 2>&1; then wget -qO- '${escapedUrl}'; ` +
					`else echo 'ERROR: neither curl nor wget is available on the target host' >&2; exit 2; fi | bash -s -- ${cliFlags}`;

				logger.debug(cmd);
				// Stream the command output back to the client
				cmdStreamer(host, cmd, res).then(() => {
					// Clear the server-side application cache
					logger.debug('Installation complete, clearing cache');
					clearCache();
				});

			} catch (err) {
				return res.status(400).json({success: false, error: err.message});
			}
		})
		.catch(e => {
			return res.status(400).json({ success: false, error: e.message });
		});
	}).catch(e => {
		return res.status(400).json({ success: false, error: e.message });
	});
});

module.exports = router;
