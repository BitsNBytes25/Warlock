const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {getLatestServiceMetrics} = require("../../libs/get_latest_service_metrics.mjs");
const {getApplicationMetrics} = require("../../libs/get_application_metrics.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostApplication} = require("../../libs/validate_host_application.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");

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
			// On updates to the service state, clear the cache for the application
			clearTaggedCache(req.appInstallData.host, req.appInstallData.guid);

			// Check if the application responded "CreatedService:..." in stdout.
			// That's the identifier of the newly created service.
			let lines = output.stdout.trim().split('\n'),
				lastLine = lines[lines.length - 1],
				newService = null;

			if (lastLine.startsWith('CreatedService:')) {
				newService = lastLine.split(':')[1].trim();
			}

			res.json({
				success: true,
				newService: newService,
				url: newService ? `/service/details/${req.appInstallData.guid}/${req.appInstallData.host}/${newService}` : null,
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
			// On updates to the service state, clear the cache for the application
			clearTaggedCache(req.appInstallData.host, req.appInstallData.guid);

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
 * Stream "live" metrics and stats for a given service
 *
 * Only updates are sent to the client every 5 seconds.
 */
router.get('/stream/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	let clientGone = false,
		serviceData = req.serviceData,
		lastDataSent = Date.now();

	res.writeHead(200, {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive'
	});

	const onClientClose = () => {
		if (clientGone) return;
		clientGone = true;
	};

	const arraysDiffer = (a, b) => {
		const lenA = a.length, lenB = b.length;
		if (lenA !== lenB) return true;
		for (let i = 0; i < lenA; i++) {
			if (a[i] !== b[i]) return true;
		}
		return false;
	};

	const diffKeys = (oldData, newData) => {
		const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]),
			diff = {};

		for (const key of keys) {
			if (newData[key] === undefined) {
				// Key exists in the old data, but not the new; that's fine.
				continue;
			}
			if (Array.isArray(oldData[key]) && Array.isArray(newData[key])) {
				if (arraysDiffer(oldData[key], newData[key])) {
					diff[key] = newData[key];
				}
			}
			else if (oldData[key] !== newData[key]) {
				diff[key] = newData[key];
			}
		}
		return diff;
	};

	const lookup = () => {
		if (clientGone) return;

		// Get the live metrics for this service
		getApplicationMetrics(req.appInstallData, req.serviceData.service).then(results => {
			if (clientGone) return;

			const newServiceData = results.services[req.serviceData.service],
				diffData = diffKeys(serviceData, newServiceData);

			// Save the data for the next iteration
			serviceData = Object.assign(serviceData, newServiceData);

			// Write a response if we have differences.
			if (Object.keys(diffData).length > 0) {
				res.write(`json: ${JSON.stringify(diffData)}\n\n`);
				lastDataSent = Date.now();
			}
			else if (Date.now() - lastDataSent > 60000) {
				res.write(':keepalive\n\n');
				lastDataSent = Date.now();
			}

			// Wait 5 seconds for the next scan
			// We do this vs an interval because the SSH connection / lookup may take a few seconds to complete.
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
