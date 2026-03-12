const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {getLatestServiceMetrics} = require("../../libs/get_latest_service_metrics.mjs");
const {getApplicationMetrics} = require("../../libs/get_application_metrics.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");

const router = express.Router();

/**
 * Get a single service and its status from a given host and application GUID
 *
 * API endpoint: GET /api/service/:guid/:host/:service
 *
 * Returns JSON data with success (True/False), service data, and host install data
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.get('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	// Get latest metrics for the service
	getLatestServiceMetrics(req.appInstallData.guid, req.appInstallData.host, req.serviceData.service)
		.then(metrics => {
			return res.json({
				success: true,
				service: {...req.serviceData, ...metrics},
				host: req.appInstallData,
			});
		});
});

/**
 * Create a single service on a given host and application.
 *
 * API endpoint: PUT /api/service/:guid/:host/:service
 *
 * Returns JSON data with success (True/False), stdout, and stderr
 *
 * @property {AppInstallData} req.appInstallData
 */
router.put('/:guid/:host/:service', validate_session, validateHostApplication, (req, res) => {
	// Check if the application supports the 'cmd' option
	if (!req.appInstallData.options.includes('create-service')) {
		return res.json({
			success: false,
			error: 'This application does not support creating services'
		});
	}
	// Execute the command via manage.py
	const cmd = req.appInstallData.getServiceCommandString('create-service', req.params.service);
	cmdRunner(req.appInstallData.host, cmd)
		.then(output => {
			res.json({
				success: true,
				stdout: output.stdout,
				stderr: output.stderr
			});
		})
		.catch(e => {
			res.json({
				success: false,
				error: e.error ? e.error.message : e.message
			});
		});
});

/**
 * Delete a single service from a given host and application GUID
 *
 * API endpoint: DELETE /api/service/:guid/:host/:service
 *
 * Returns JSON data with success (True/False), service data, and host install data
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.delete('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	if (!req.appInstallData.options.includes('remove-service')) {
		return res.json({
			success: false,
			error: 'This application does not support deleting services'
		});
	}

	// Execute the command via manage.py
	const cmd = req.appInstallData.getServiceCommandString('remove-service', req.params.service);
	cmdRunner(req.appInstallData.host, cmd)
		.then(output => {
			res.json({
				success: true,
				stdout: output.stdout,
				stderr: output.stderr
			});
		})
		.catch(e => {
			res.json({
				success: false,
				error: e.error ? e.error.message : e.message
			});
		});
});

router.get('/stream/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	let clientGone = false;

	res.writeHead(200, {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive'
	});

	const onClientClose = () => {
		if (clientGone) return;
		clientGone = true;
	};

	const lookup = () => {
		if (clientGone) return;

		// Get the live metrics for this service
		getApplicationMetrics(req.appInstallData, req.serviceData.service).then(results => {
			if (clientGone) return;

			let ret = {
				host: req.appInstallData,
				service: results.services[req.serviceData.service],
			};

			ret.service['response_time'] = results.response_time;

			res.write(`data: ${JSON.stringify(ret)}\n\n`);

			setTimeout(lookup,5000);
		}).catch(e => {
			if (clientGone) return;

			res.write(`data: ${JSON.stringify({
				success: false,
				error: e.message,
			})}\n\n`);
		});
	};

	// Track client disconnects
	req.on('close', onClientClose);
	req.on('aborted', onClientClose);
	res.on('close', onClientClose);

	lookup();
});

module.exports = router;
