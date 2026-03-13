const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {getAllServices} = require("../../libs/get_all_services.mjs");
const {getLatestServiceMetrics} = require("../../libs/get_latest_service_metrics.mjs");
const cache = require("../../libs/cache.mjs");
const {injectHosts} = require("../../libs/inject_hosts.mjs");
const {getApplicationMetrics} = require("../../libs/get_application_metrics.mjs");
const {diffObjects} = require("../../libs/diff_objects.mjs");
const {logger} = require("../../libs/logger.mjs");

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
				let metrics = await getLatestServiceMetrics(svcEntry.host.guid, svcEntry.host.host, svcEntry.service.service),
					cached_players = cache.default.get(`players_${svcEntry.host.guid}_${svcEntry.host.host}_${svcEntry.service.service}`);
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

/**
 * Stream all services and their stats
 *
 * @property {HostData[]} res.locals.hosts
 */
router.get(
	'/stream',
	validate_session,
	injectHosts,
	async (req, res) => {
		//let test = [];

		let installs = [],
			data = {},
			clientGone = false,
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

		/**
		 *
		 * @param {HostAppData} appInstall
		 * @returns {Promise<void>}
		 */
		const lookup = async (appInstall) => {
			if (clientGone) return;

			// Get the live metrics for this host
			let metrics;
			try{
				metrics = await getApplicationMetrics(appInstall);
			}
			catch(e) {
				logger.warn(e);
				// Schedule the next lookup
				setTimeout(lookup,30000, appInstall);
				return;
			}


			if (clientGone) return;

			for( let svc of Object.keys(metrics.services) ) {
				let svcEntry = metrics.services[svc];
				let key = `${appInstall.guid}_${appInstall.host}_${svcEntry.service}`;
				if (!data.hasOwnProperty(key)) {
					data[key] = {};
				}

				const diffData = diffObjects(data[key], svcEntry);
				data[key] = svcEntry;

				// Write a response if we have differences.
				if (Object.keys(diffData).length > 0) {
					// Ensure the resulting data contains tracking keys, as this will support multiple services.
					diffData.guid = appInstall.guid;
					diffData.host = appInstall.host;
					diffData.service = svc;
					res.write(`json: ${JSON.stringify(diffData)}\n\n`);
					lastDataSent = Date.now();
				}
				else if (Date.now() - lastDataSent > 60000) {
					res.write(':keepalive\n\n');
					lastDataSent = Date.now();
				}
			}

			// Schedule the next lookup in 5 seconds
			setTimeout(lookup,10000, appInstall);
		};

		// Track client disconnects
		req.on('close', onClientClose);
		req.on('aborted', onClientClose);
		res.on('close', onClientClose);

		for( let host of res.locals.hosts) {
			let appInstalls = await host.getInstalls();

			for (let appInstall of appInstalls) {
				//let key = `${appInstall.guid}_${appInstall.host}`;
				lookup(appInstall);
			}
		}
	}
);





module.exports = router;
