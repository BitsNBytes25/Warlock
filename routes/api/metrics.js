const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {HostMetricModel} = require('../../db/models/host_metric.mjs');
const {MetricModel} = require('../../db/models/metric.mjs');
const {sql, gte, eq, and, asc} = require("drizzle-orm");
const {db} = require("../../db/db.mjs");
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

		// Drizzle equivalent of literal(`(timestamp / ${metricGroup}) * ${metricGroup}`)
		const table = MetricModel.prototype._tableDefinition;
		const intervalExpr = sql`((${table.timestamp} / ${metricGroup}) * ${metricGroup})`;
		const query = db.select({ // Assuming 'db' is your initialized Drizzle DB instance
			interval_start: intervalExpr,
			avg_cpu_usage: sql`avg(${table.cpu_usage})`,
			avg_memory_usage: sql`avg(${table.memory_usage})`,
			avg_player_count: sql`avg(${table.player_count})`,
			avg_response_time: sql`avg(${table.response_time})`,
			avg_status: sql`avg(${table.status})`,
		}).from(table) // Assuming Metric is your Drizzle table definition for the 'metric' table
			.where(and(
				eq(table.ip, ip),
				eq(table.service, service),
				gte(table.timestamp, startTime)
			))
			.groupBy(intervalExpr) // Group by the calculated interval expression
			.orderBy(asc(intervalExpr)); // Order by the calculated interval_start ascending
		//console.log(query.toSQL());
		const results = await query.execute();
		
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

		const table = HostMetricModel.prototype._tableDefinition;
		const intervalExpr = sql`((${table.timestamp} / ${metricGroup}) * ${metricGroup})`;
		const query = db.select({ // Assuming 'db' is your initialized Drizzle DB instance
			interval_start: intervalExpr,
			avg_cpu: sql`avg(${table.cpu})`,
			avg_memory: sql`avg(${table.memory})`,
			avg_disk: sql`avg(${table.disk})`,
			avg_rx: sql`avg(${table.rx})`,
			avg_tx: sql`avg(${table.tx})`,
		}).from(table) // Assuming Metric is your Drizzle table definition for the 'metric' table
			.where(and(
				eq(table.ip, ip),
				gte(table.timestamp, startTime)
			))
			.groupBy(intervalExpr) // Group by the calculated interval expression
			.orderBy(asc(intervalExpr)); // Order by the calculated interval_start ascending
		//console.log(query.toSQL());
		const results = await query.execute();

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
