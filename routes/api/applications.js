const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {getAllApplications} = require("../../libs/get_all_applications.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");

const router = express.Router();

/**
 * Get installed applications and which hosts each is installed on
 *
 * API endpoint: GET /api/applications
 * Optional endpoint: GET /api/applications?all=1 (Returns all applications, even if no hosts are installed)
 *
 * Returns JSON data with success (True/False) and applications {Object<string, AppData>}
 */
router.get('/', validate_session, (req, res) => {
	const { all = '0' } = req.query;

	getAllApplications()
		.then(applications => {
			if (all !== '1') {
				applications = Object.values(applications).filter(app => app.installs.length > 0);
			}

			return res.json({
				success: true,
				applications: applications,
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.message
			});
		});
});

/**
 * Get all application/hosts that have updates available
 *
 * API endpoint: GET /api/applications/updates
 *
 * Returns JSON data with success (True/False) and updates {Array<guid: string, host: string>}
 */
router.get('/updates', validate_session, (req, res) => {
	getAllApplications()
		.then(applications => {
			let promises = [];

			Object.values(applications).forEach(application => {
				application.installs.forEach(hostData => {
					promises.push(cmdRunner(hostData.host, hostData.getCommandString('check-update'), {application, hostData}));
				});
			});

			Promise.allSettled(promises).then(results => {
				let updates = [];

				results.forEach(result => {
					// Most results here should be REJECTED; as that indicates an update is not available.
					// Only FULFILLED results indicate an update is available.
					if (result.status === 'fulfilled') {
						updates.push({
							guid: result.value.extraFields.application.guid,
							host: result.value.extraFields.hostData.host
						});
					}
				});

				return res.json({
					success: true,
					updates: updates
				});
			});
		});
});


module.exports = router;