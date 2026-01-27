const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {Metric, HostMetric} = require('../../db.js');
const {Op} = require('sequelize');
const router = express.Router();

// Retrieve historical metrics for a service
router.get('/:ip/:service', validate_session, async (req, res) => {
	try {
		const {ip, service} = req.params;
		const {timeframe = 'hour'} = req.query;
		
		// Calculate time range based on timeframe
		const now = Math.floor(Date.now() / 1000);
		let startTime;
		
		switch(timeframe) {
			case 'hour':
				startTime = now - (60 * 60);
				break;
			case 'today':
				const todayStart = new Date();
				todayStart.setHours(0, 0, 0, 0);
				startTime = Math.floor(todayStart.getTime() / 1000);
				break;
			case 'day':
				startTime = now - (24 * 60 * 60);
				break;
			case 'week':
				startTime = now - (7 * 24 * 60 * 60);
				break;
			case 'month':
				startTime = now - (30 * 24 * 60 * 60);
				break;
			case '3month':
				startTime = now - (90 * 24 * 60 * 60);
				break;
			case '6month':
				startTime = now - (180 * 24 * 60 * 60);
				break;
			case 'year':
				startTime = now - (365 * 24 * 60 * 60);
				break;
			default:
				startTime = now - (60 * 60);
		}
		
		const metrics = await Metric.findAll({
			where: {
				ip,
				service,
				timestamp: {
					[Op.gte]: startTime
				}
			},
			order: [['timestamp', 'ASC']],
			raw: true
		});
		
		return res.json({success: true, data: metrics});
	} catch (error) {
		console.error('Error retrieving metrics:', error);
		return res.json({success: false, error: error.message});
	}
});

// Retrieve historical metrics for a host
router.get('/:ip', validate_session, async (req, res) => {
	try {
		const {ip} = req.params;
		const {timeframe = 'hour'} = req.query;

		// Calculate time range based on timeframe
		const now = Math.floor(Date.now() / 1000);
		let startTime;

		switch(timeframe) {
			case 'hour':
				startTime = now - (60 * 60);
				break;
			case 'today':
				const todayStart = new Date();
				todayStart.setHours(0, 0, 0, 0);
				startTime = Math.floor(todayStart.getTime() / 1000);
				break;
			case 'day':
				startTime = now - (24 * 60 * 60);
				break;
			case 'week':
				startTime = now - (7 * 24 * 60 * 60);
				break;
			case 'month':
				startTime = now - (30 * 24 * 60 * 60);
				break;
			case '3month':
				startTime = now - (90 * 24 * 60 * 60);
				break;
			case '6month':
				startTime = now - (180 * 24 * 60 * 60);
				break;
			case 'year':
				startTime = now - (365 * 24 * 60 * 60);
				break;
			default:
				startTime = now - (60 * 60);
		}

		const metrics = await HostMetric.findAll({
			where: {
				ip,
				timestamp: {
					[Op.gte]: startTime
				}
			},
			order: [['timestamp', 'ASC']],
			raw: true
		});

		return res.json({success: true, data: metrics});
	} catch (error) {
		console.error('Error retrieving metrics:', error);
		return res.json({success: false, error: error.message});
	}
});

module.exports = router;
