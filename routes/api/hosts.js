const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {Host} = require('../../db');
const {getHostMetrics} = require('../../libs/get_host_metrics.mjs');

const router = express.Router();

/**
 * API endpoint to get all enabled hosts and their general information
 */
router.get('/', validate_session, (req, res) => {
	Host.findAll().then(hosts => {
		let promises = [];
		hosts.forEach(host => {
			// In one SSH session, retrieve the device hostname, mounted disks and their free/used space,
			// and OS name and version.

//echo "NETWORK_STATS:"
//cat /proc/net/dev | grep -v "lo:" | awk "NR>2 {rx+=\\$2; tx+=\\$10} END {print rx, tx}"

//echo "CONNECTIONS:"
//ss -tuln | wc -l


//echo "SYSTEM_STATS_END"

			promises.push(getHostMetrics(host.ip));
		});

		Promise.allSettled(promises).then(results => {
			let ret = {};
			results.forEach(result => {
				if (result.status === 'fulfilled') {
					ret[result.value.ip] = result.value;
				}
				else {
					ret[result.reason.extraFields.host] = {
						ip: result.reason.extraFields.host,
						connected: false,
						error: result.reason.message
					};
				}
			});

			return res.json({
				success: true,
				hosts: ret
			});
		});
	});
});

module.exports = router;
