const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const {cmdStreamer} = require("../../libs/cmd_streamer.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {getAppInstaller} = require("../../libs/get_app_installer.mjs");
const {logger} = require("../../libs/logger.mjs");
const {Host} = require("../../db");
const {getAllApplications} = require("../../libs/get_all_applications.mjs");
const {clearCache} = require("../../libs/cache.mjs");
const {push_analytics} = require("../../libs/push_analytics.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {buildRemoteExec} = require("../../libs/build_remote_exec.mjs");

const router = express.Router();

/**
 * PUT /api/application
 * Streams SSH output back to the client in real-time as text/event-stream (SSE-like chunks)
 * Route: PUT /api/application/install/:guid/:host
 */
router.put('/:guid/:host', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host,
		options = req.body.options || [];

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
				let branch = null,
					url = null,
					cmdData = null;

				if (appData.source && appData.source.toLowerCase() === 'github' && appData.repo) {
					// Check to see if the user submitted a branch for this installer
					options.forEach(option => {
						if (option.startsWith('--branch') && option.includes('=')) {
							// This is used to determine the install source, (if provided).
							branch = option.split('=')[1];
						}
					});
					if (branch) {
						url = `https://raw.githubusercontent.com/${appData.repo}/refs/heads/${branch}/${appData.installer}`;
					}
				}

				if (!url) {
					// Lookup the installer URL via the fallback method
					url = await getAppInstaller(appData);
				}

				if (!url) {
					// No installer URL available
					return res.status(400).json({
						success: false,
						error: 'No installer URL found for application ' + guid
					});
				}

				// Use buildRemoteExec to build the actual command to pass to the guest.
				cmdData = buildRemoteExec(url, Array.prototype.concat(options, ['--non-interactive']));

				logger.debug(cmdData);
				logger.info(`Installing ${appData.title} on host ${host} with flags ${cmdData.parameters.join(', ')}`);
				push_analytics(`App Install / ${appData.title}`);

				// Stream the command output back to the client
				cmdStreamer(host, cmdData.cmd, res).then(() => {
					// Clear the server-side application cache
					logger.debug('Installation complete, clearing cache');
					clearCache();
				}).catch(() => { });

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

/**
 * DELETE /api/application
 * Streams SSH output back to the client in real-time as text/event-stream (SSE-like chunks)
 * Route: DELETE /api/application/:guid/:host
 */
router.delete('/:guid/:host', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host;

	if (!guid || !host) {
		return res.status(400).json({ success: false, error: 'Missing guid or host' });
	}

	// Validate that the host and application exist and are related
	validateHostApplication(host, guid).then(async data => {
		try {
			// data.app should be an AppData object

			// Determine if the installer.sh file is present on the remote host
			// and execute it directly with the necessary flags.
			// If it's not present, pull the installer from the install source and run it with the uninstallation parameters.
			// This is to better support version-specific tasks which may change over time.
			cmdRunner(host, `[ -x "${data.host.path}/installer.sh" ] && echo -n yes || echo -n no`).then(async result => {
				let cmd;

				if (result.stdout === 'yes') {
					// Installer exists on remote host, run it directly
					cmd = `"${data.host.path}/installer.sh" --non-interactive --uninstall`;
				}
				else {
					// Installer does not exist on remote host, use the streaming method
					const url = await getAppInstaller(data.app);


					if (!url) {
						// No installer URL available
						return res.status(400).json({ success: false, error: 'No installer URL found for application ' + guid });
					}
					// Use buildRemoteExec to build the actual command to pass to the guest.
					const cmdData = buildRemoteExec(url, ['--non-interactive', '--uninstall']);
					cmd = cmdData.cmd;
				}

				// Stream the command output back to the client
				cmdStreamer(host, cmd, res).then(() => {
					// Clear the server-side application cache
					clearCache();
				}).catch(() => { });
			});
		} catch (err) {
			return res.status(400).json({ success: false, error: err.message });
		}
	}).catch(e => {
		return res.status(400).json({ success: false, error: e.message });
	});
});

module.exports = router;
