const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const { cmdRunner } = require("../../libs/cmd_runner.mjs");
const { logger } = require('../../libs/logger.mjs');
const {validateHost} = require("../../libs/validate_host.mjs");

const router = express.Router();

// GET status
router.get('/:host', validate_session, validateHost, (req, res) => {

	let ports = [],
		promises = [];

	req.hostData.getInstalls().then(async installs => {
		installs.forEach(install => {
			promises.push(
				cmdRunner(install.host, install.getCommandString('get-ports'))
					.then(result => {
						const portsData = JSON.parse(result.stdout);
						portsData.forEach(portData => {
							ports.push({
								guid: install.guid,
								port: portData['value'],
								protocol: portData['protocol'],
								config: portData['config'],
								service: portData['service'],
								description: portData['description'],
							});
						});
					})
					.catch(e => {
						logger.error(`Error parsing port data from host ${install.host} for app ${install.guid}: ${e.message}`);
					})
			);
		});

		await Promise.allSettled(promises);
		return res.json({ success: true, ports: ports });
	});
});

module.exports = router;
