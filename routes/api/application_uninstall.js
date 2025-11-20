const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {getAppInstaller} = require("../../libs/get_app_installer.mjs");

const router = express.Router();

/**
 * POST /api/application/uninstall
 * Streams SSH output back to the client in real-time as text/event-stream (SSE-like chunks)
 * Route: POST /api/application/uninstall/:guid/:host
 */
router.post('/:guid/:host', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host;

	if (!guid || !host) {
		return res.status(400).json({ success: false, error: 'Missing guid or host' });
	}

	// Validate that the host and application exist and are related
	validateHostApplication(host, guid).then(async data => {
		try {
			// data.app should be an AppData object
			const url = await getAppInstaller(data.app);
			if (!url) {
				// No installer URL available
				return res.status(400).json({ success: false, error: 'No installer URL found for application ' + guid });
			}

			// Safely escape any single quotes in the URL for embedding in single-quoted shell literals
			const escapedUrl = String(url).replace(/'/g, "'\\''");

			// Build a command that streams the installer directly into bash to avoid writing to /tmp
			// It prefers curl, falls back to wget, and prints a clear error if neither is available.
			const cmd = `set -euo pipefail; ` +
				`if command -v curl >/dev/null 2>&1; then curl -fsSL '${escapedUrl}'; ` +
				`elif command -v wget >/dev/null 2>&1; then wget -qO- '${escapedUrl}'; ` +
				`else echo 'ERROR: neither curl nor wget is available on the target host' >&2; exit 2; fi | bash -s -- --non-interactive --uninstall`;

			// Stream the command output back to the client
			cmdStreamer(host, cmd, res);
		} catch (err) {
			return res.status(400).json({ success: false, error: err.message });
		}
	}).catch(e => {
		return res.status(400).json({ success: false, error: e.message });
	});
});

module.exports = router;
