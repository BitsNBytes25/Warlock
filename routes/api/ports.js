const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const { cmdRunner } = require("../../libs/cmd_runner.mjs");
const { Host } = require('../../db');
const { logger } = require('../../libs/logger.mjs');
const {getAllApplications} = require("../../libs/get_all_applications.mjs");

const router = express.Router();

// GET status
router.get('/:host', validate_session, (req, res) => {
	const host = req.params.host;

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		let ports = [],
			promises = [];
		getAllApplications().then(results => {
			Object.values(results).forEach(app => {
				app.hosts.forEach(hostData => {
					if (hostData.host === host) {
						promises.push(cmdRunner(host, `${hostData.path}/manage.py --get-ports`, app.guid));
					}
				});
			});

			Promise.allSettled(promises).then(results => {
				results.forEach(result => {
					if (result.status === 'fulfilled') {
						const stdout = result.value.stdout,
							appGuid = result.value.extraFields;
						try {
							const portsData = JSON.parse(stdout);
							portsData.forEach(portData => {
								ports.push({
									guid: appGuid,
									port: portData['value'],
									protocol: portData['protocol'],
									config: portData['config'],
									service: portData['service'],
									description: portData['description'],
								});
							});
						} catch (e) {
							logger.error(`Error parsing port data from host ${host} for app ${appGuid}: ${e.message}`);
						}
					}
				});

				return res.json({ success: true, ports: ports });
			});
		});
	});
});

module.exports = router;
