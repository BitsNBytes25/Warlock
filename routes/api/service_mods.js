const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {validateHostService} = require("../../libs/validate_host_service.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");

const router = express.Router();

/**
 * Get enabled mods for a given service
 *
 * API endpoint: GET /api/service/mods/:guid/:host/:service
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.get(
	'/:guid/:host/:service',
	validate_session,
	validateHostService,
	(req, res) => {
	const appInstallData = req.appInstallData,
		host = req.appInstallData.host,
		service = req.serviceData.service,
		cmd = appInstallData.getServiceCommandString('get-mods', service)

	cmdRunner(host, cmd)
		.then(result => {
			return res.json({
				success: true,
				output: result.stdout.trim(),
				stderr: result.stderr
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.error ? e.error.message : e.message
			});
		});
});

/**
 * Add a new mod for a given service
 *
 * API endpoint: POST /api/service/mods/:guid/:host/:service
 *
 * Data payload (JSON):
 *
 * * id: The mod ID to add
 * * provider: The mod provider (e.g. 'steam')
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.post(
	'/:guid/:host/:service',
	validate_session,
	validateHostService,
	(req, res) => {
		const appInstallData = req.appInstallData,
			host = req.appInstallData.host,
			service = req.serviceData.service,
			{ id, provider } = req.body || {},
			cmd = appInstallData.getServiceCommandString('install-mod', service, '--id', id, '--provider', provider);

		if (!id) {
			return res.json({
				success: false,
				error: 'Mod ID is required'
			});
		}

		cmdRunner(host, cmd)
			.then(result => {
				return res.json({
					success: true,
					output: result.stdout.trim(),
					stderr: result.stderr
				});
			})
			.catch(e => {
				return res.json({
					success: false,
					error: e.error ? e.error.message : e.message
				});
			});
	}
);

/**
 * Remove a mod from a given service
 *
 * API endpoint: DELETE /api/service/mods/:guid/:host/:service
 *
 * Data payload (JSON):
 *
 * * id: The mod ID to add
 * * provider: The mod provider (e.g. 'steam')
 *
 * @property {AppInstallData} req.appInstallData
 * @property {ServiceData} req.serviceData
 */
router.delete(
	'/:guid/:host/:service',
	validate_session,
	validateHostService,
	(req, res) => {
		const appInstallData = req.appInstallData,
			host = req.appInstallData.host,
			service = req.serviceData.service,
			{ id, provider } = req.body || null,
			cmd = appInstallData.getServiceCommandString('remove-mod', service, '--id', id, '--provider', provider)

		cmdRunner(host, cmd)
			.then(result => {
				return res.json({
					success: true,
					output: result.stdout.trim(),
					stderr: result.stderr
				});
			})
			.catch(e => {
				return res.json({
					success: false,
					error: e.error ? e.error.message : e.message
				});
			});
	}
);

module.exports = router;
