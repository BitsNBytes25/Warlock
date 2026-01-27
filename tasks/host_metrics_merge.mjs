import {HostMetric, sequelize} from "../db.js";
import {Op, QueryTypes} from 'sequelize';
import {logger} from "../libs/logger.mjs";

/**
 * Merge host metrics down to aggregated sizes to reduce database size.
 *
 * Metrics between 1 week and 1 day old are merged to 5 minute intervals.
 * Metrics between 1 month and 1 week old are merged to 1 hour intervals.
 * Metrics older than 1 month are merged to 1 day intervals.
 * Metrics older than 1 year are deleted.
 *
 * @constructor
 */
export async function HostMetricsMergeTask() {
	const now = Math.floor(Date.now() / 1000),
		oneDay = 24 * 60 * 60,
		oneWeek = 7 * oneDay,
		oneMonth = 30 * oneDay,
		oneYear = 365 * oneDay,
		fiveMinutes = 5 * 60,
		oneHour = 60 * 60;

	try {
		// Delete metrics older than 1 year
		const deleteCount = await HostMetric.destroy({
			where: {
				timestamp: {
					[Op.lt]: now - oneYear
				}
			}
		});

		if (deleteCount > 0) {
			logger.info(`HostMetricsMergeTask: Deleted ${deleteCount} metrics older than 1 year`);
		}

		// Merge metrics between 1 day and 1 week old to 5 minute intervals
		await mergeHostMetricsToInterval(now - oneWeek, now - oneDay, fiveMinutes, '5 minute');

		// Merge metrics between 1 week and 1 month old to 1 hour intervals
		await mergeHostMetricsToInterval(now - oneMonth, now - oneWeek, oneHour, '1 hour');

		// Merge metrics older than 1 month (but less than 1 year) to 1 day intervals
		await mergeHostMetricsToInterval(now - oneYear, now - oneMonth, oneDay, '1 day');

		logger.info('HostMetricsMergeTask: Completed successfully');
	} catch (error) {
		logger.error('HostMetricsMergeTask: Error merging metrics:', error.message);
	}
}

/**
 * Merge metrics within a time range to a specific interval
 */
async function mergeHostMetricsToInterval(startTime, endTime, intervalSeconds, intervalName) {
	const transaction = await sequelize.transaction();

	try {
		// Get all unique combinations of ip, app_guid, and service in the time range
		const uniqueHosts = await sequelize.query(
			`SELECT DISTINCT ip FROM HostMetrics 
			 WHERE timestamp >= :startTime AND timestamp < :endTime`,
			{
				replacements: { startTime, endTime },
				type: QueryTypes.SELECT,
				transaction
			}
		);

		let mergedCount = 0;

		for (const host of uniqueHosts) {
			// Get metrics for this service in the time range
			const metrics = await HostMetric.findAll({
				where: {
					ip: host.ip,
					timestamp: {
						[Op.gte]: startTime,
						[Op.lt]: endTime
					}
				},
				order: [['timestamp', 'ASC']],
				raw: true,
				transaction
			});

			if (metrics.length === 0) continue;

			// Group metrics by interval
			const intervalGroups = {};

			for (const metric of metrics) {
				const intervalKey = Math.floor(metric.timestamp / intervalSeconds) * intervalSeconds;

				if (!intervalGroups[intervalKey]) {
					intervalGroups[intervalKey] = [];
				}

				intervalGroups[intervalKey].push(metric);
			}

			// For each interval group, create aggregated metric and delete originals
			for (const [intervalTimestamp, groupMetrics] of Object.entries(intervalGroups)) {
				// Skip if already aggregated (only one metric in interval)
				if (groupMetrics.length <= 1) continue;

				// Calculate averages
				const avgCpuUsage = groupMetrics.reduce((sum, m) => sum + (m.cpu || 0), 0) / groupMetrics.length,
					avgMemoryUsage = groupMetrics.reduce((sum, m) => sum + (m.memory || 0), 0) / groupMetrics.length,
					avgDiskUsage = groupMetrics.reduce((sum, m) => sum + (m.disk || 0), 0) / groupMetrics.length,
					avgNetRx = groupMetrics.reduce((sum, m) => sum + (m.disk || 0), 0) / groupMetrics.length,
					avgNetTx = groupMetrics.reduce((sum, m) => sum + (m.disk || 0), 0) / groupMetrics.length;

				// Delete all metrics in this interval
				await HostMetric.destroy({
					where: {
						ip: host.ip,
						timestamp: {
							[Op.gte]: parseInt(intervalTimestamp),
							[Op.lt]: parseInt(intervalTimestamp) + intervalSeconds
						}
					},
					transaction
				});

				// Create aggregated metric
				await HostMetric.create({
					ip: host.ip,
					timestamp: parseInt(intervalTimestamp),
					cpu: parseInt(avgCpuUsage),
					memory: parseInt(avgMemoryUsage),
					disk: parseInt(avgDiskUsage),
					rx: parseInt(avgNetRx),
					tx: parseInt(avgNetTx)
				}, { transaction });

				mergedCount += groupMetrics.length - 1; // Count how many metrics were merged
			}
		}

		await transaction.commit();

		if (mergedCount > 0) {
			logger.info(`HostMetricsMergeTask: Merged ${mergedCount} metrics to ${intervalName} intervals`);
		}
	} catch (error) {
		await transaction.rollback();
		logger.error(`HostMetricsMergeTask: Error merging to ${intervalName} intervals:`, error.message);
		throw error;
	}
}