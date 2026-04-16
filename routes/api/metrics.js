const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {Metric, HostMetric} = require('../../db.js');
const {Op, fn, col, literal} = require('sequelize');
const router = express.Router();

// Retrieve historical metrics for a service
router.get('/:ip/:service', validate_session, async (req, res) => {
	try {
		const {ip, service} = req.params;
		const {timeframe = 'hour'} = req.query;
		
		// Calculate time range based on timeframe
		const now = Math.floor(Date.now() / 1000);
		let startTime,
			metricGroup;
		
		switch(timeframe) {
			case 'hour':
				startTime = now - (60 * 60);
				metricGroup = 60;
				break;
			case 'today':
				const todayStart = new Date();
				todayStart.setHours(0, 0, 0, 0);
				startTime = Math.floor(todayStart.getTime() / 1000);
				metricGroup = 15 * 60; // Group results by 15-minute intervals
				break;
			case 'day':
				startTime = now - (24 * 60 * 60);
				metricGroup = 15 * 60; // Group results by 15-minute intervals
				break;
			case 'week':
				startTime = now - (7 * 24 * 60 * 60);
				metricGroup = 60 * 60; // Group results by 1-hour intervals
				break;
			case 'month':
				startTime = now - (30 * 24 * 60 * 60);
				metricGroup = 6 * 60 * 60; // Group results by 6-hour intervals
				break;
			case '3month':
				startTime = now - (90 * 24 * 60 * 60);
				metricGroup = 24 * 60 * 60; // Group results by 24-hour intervals
				break;
			case '6month':
				startTime = now - (180 * 24 * 60 * 60);
				metricGroup = 48 * 60 * 60; // Group results by 48-hour intervals
				break;
			case 'year':
				startTime = now - (365 * 24 * 60 * 60);
				metricGroup = 7 * 24 * 60 * 60; // Group results by 7-day intervals
				break;
			default:
				startTime = now - (60 * 60);
				metricGroup = 60;
		}

		const intervalExpr = literal(`(timestamp / ${metricGroup}) * ${metricGroup}`);
		const results = await Metric.findAll({
			attributes: [
				[intervalExpr, 'interval_start'],
				[fn('AVG', col('cpu_usage')), 'avg_cpu_usage'],
				[fn('AVG', col('memory_usage')), 'avg_memory_usage'],
				[fn('AVG', col('player_count')), 'avg_player_count'],
				[fn('AVG', col('response_time')), 'avg_response_time'],
				[fn('AVG', col('status')), 'avg_status'],
			],
			where: {
				ip,
				service,
				timestamp: {
					[Op.gte]: startTime
				}
			},
			group: [intervalExpr],
			order: [[literal('interval_start'), 'ASC']],
			raw: true
		});
		
		return res.json({
			success: true,
			timeframe,
			timestamp: startTime,
			host: ip,
			service: service,
			grouping: metricGroup,
			data: results
		});
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
		let startTime,
			metricGroup;

		switch(timeframe) {
			case 'hour':
				startTime = now - (60 * 60);
				metricGroup = 60;
				break;
			case 'today':
				const todayStart = new Date();
				todayStart.setHours(0, 0, 0, 0);
				startTime = Math.floor(todayStart.getTime() / 1000);
				metricGroup = 15 * 60; // Group results by 15-minute intervals
				break;
			case 'day':
				startTime = now - (24 * 60 * 60);
				metricGroup = 15 * 60; // Group results by 15-minute intervals
				break;
			case 'week':
				startTime = now - (7 * 24 * 60 * 60);
				metricGroup = 60 * 60; // Group results by 1-hour intervals
				break;
			case 'month':
				startTime = now - (30 * 24 * 60 * 60);
				metricGroup = 6 * 60 * 60; // Group results by 6-hour intervals
				break;
			case '3month':
				startTime = now - (90 * 24 * 60 * 60);
				metricGroup = 24 * 60 * 60; // Group results by 24-hour intervals
				break;
			case '6month':
				startTime = now - (180 * 24 * 60 * 60);
				metricGroup = 48 * 60 * 60; // Group results by 48-hour intervals
				break;
			case 'year':
				startTime = now - (365 * 24 * 60 * 60);
				metricGroup = 7 * 24 * 60 * 60; // Group results by 7-day intervals
				break;
			default:
				startTime = now - (60 * 60);
				metricGroup = 60;
		}

		const intervalExpr = literal(`(timestamp / ${metricGroup}) * ${metricGroup}`);
		const results = await HostMetric.findAll({
			attributes: [
				[intervalExpr, 'interval_start'],
				[fn('AVG', col('cpu')), 'avg_cpu'],
				[fn('AVG', col('memory')), 'avg_memory'],
				[fn('AVG', col('disk')), 'avg_disk'],
				[fn('AVG', col('rx')), 'avg_rx'],
				[fn('AVG', col('tx')), 'avg_tx'],
			],
			where: {
				ip,
				timestamp: {
					[Op.gte]: startTime
				}
			},
			group: [intervalExpr],
			order: [[literal('interval_start'), 'ASC']],
			raw: true
		});

		return res.json({
			success: true,
			timeframe,
			timestamp: startTime,
			host: ip,
			grouping: metricGroup,
			data: results
		});
	} catch (error) {
		console.error('Error retrieving metrics:', error);
		return res.json({success: false, error: error.message});
	}
});

module.exports = router;
