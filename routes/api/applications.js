const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {getAllApplications} = require("../../libs/get_all_applications.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");

const router = express.Router();

/**
 * Get all available applications and which hosts each is installed on
 */
router.get('/', validate_session, (req, res) => {
	getAllApplications()
		.then(applications => {
			return res.json({
				success: true,
				applications: applications
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.message,
				applications: []
			});
		});
});

/**
 * Get all application/hosts that have updates available
 */
router.get('/updates', validate_session, (req, res) => {
	getAllApplications()
		.then(applications => {
			let promises = [];

			Object.values(applications).forEach(application => {
				application.hosts.forEach(hostData => {
					promises.push(cmdRunner(hostData.host, `${hostData.path}/manage.py --check-update`, {application, hostData}));
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