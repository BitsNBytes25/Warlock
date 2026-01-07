const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const cache = require("../../libs/cache.mjs");

const router = express.Router();

// Service control endpoint (start/stop/restart) - now works with all applications dynamically
router.post('/:guid/:host/:service', validate_session, (req, res) => {
	const guid = req.params.guid,
		host = req.params.host,
		service = req.params.service;
	const { action } = req.body;

	if (!(host && guid && service && action)) {
		return res.json({
			success: false,
			error: 'Host, service, and action are required'
		});
	}

	const validActions = ['start', 'stop', 'restart', 'enable', 'disable', 'delayed-stop', 'delayed-restart'];
	if (!validActions.includes(action)) {
		return res.json({
			success: false,
			error: `Invalid action. Must be one of: ${validActions.join(', ')}`
		});
	}

	validateHostService(host, guid, service)
		.then(dat => {

			let clearNeeded = true, cmd;

			if (action === 'delayed-stop' && !dat.host.options.includes('delayed-stop')) {
				return res.json({
					success: false,
					error: `Delayed stop not enabled for host '${host}' in application '${guid}'`
				});
			}

			if (action === 'delayed-restart' && !dat.host.options.includes('delayed-restart')) {
				return res.json({
					success: false,
					error: `Delayed restart not enabled for host '${host}' in application '${guid}'`
				});
			}

			if (action === 'delayed-stop' || action === 'delayed-restart') {
				clearNeeded = false;
				cmd = `${dat.host.path}/manage.py --service ${service} --${action} &`;
			}
			else if (action === 'enable' || action === 'disable') {
				clearNeeded = true;
				cmd = `systemctl ${action} ${service}`;
			}
			else {
				clearNeeded = false;
				cmd = `systemctl ${action} ${service}`;
			}


			cmdRunner(host, cmd)
				.then(result => {
					if (clearNeeded) {
						cache.default.set(`services_${guid}_${host}`, null, 1); // Invalidate cache
					}

					return res.json({
						success: true,
						output: result.stdout,
						stderr: result.stderr
					});
				})
				.catch(e => {
					return res.json({
						success: false,
						error: e.error ? e.error.message : e.message
					});
				});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.message
			});
		});
});

module.exports = router;
