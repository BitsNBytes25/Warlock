const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {getAllServices} = require("../../libs/get_all_services.mjs");
const {getAllApplications} = require("../../libs/get_all_applications.mjs");
const {logger} = require("../../libs/logger.mjs");
const {Metric} = require("../../db.js");
const {getApplicationServices} = require("../../libs/get_application_services.mjs");
const {getLatestServiceMetrics} = require("../../libs/get_latest_service_metrics.mjs");
const cache = require("../../libs/cache.mjs");

const router = express.Router();

/**
 * Get all services and their stats
 *
 * Returns JSON data with success (True/False), output/error, and services {list}
 *
 */
router.get('/', validate_session, (req, res) => {
	getAllServices()
		.then(async services => {
			// For each service, lookup the latest metrics and tack them onto the service object
			for (let svcEntry of services) {
				let metrics = await getLatestServiceMetrics(svcEntry.app, svcEntry.host.host, svcEntry.service.service),
					cached_players = cache.default.get(`players_${svcEntry.app}_${svcEntry.host.host}_${svcEntry.service.service}`);
				svcEntry.service = {...svcEntry.service, ...metrics};

				// Add in player data if available
				if (cached_players) {
					svcEntry.service.players = cached_players;
				}
				else {
					svcEntry.service.players = [];
				}
			}

			return res.json({
				success: true,
				output: '',
				services: services
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.message,
				services: []
			});
		});
});

module.exports = router;
