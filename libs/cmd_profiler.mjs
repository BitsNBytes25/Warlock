import fs from 'fs';
import path from 'path';
import {logger} from "./logger.mjs";

// Determine CSV file location based on DB_PATH if available
const getCSVPath = () => {
	if (process.env.DB_PATH) {
		const dbDir = path.dirname(process.env.DB_PATH);
		return path.join(dbDir, 'warlock-profile.csv');
	}
	return path.join(process.cwd(), 'warlock-profile.csv');
};

const CSV_FILE = getCSVPath();
const ENABLED = process.env.WARLOCK_PROFILE === '1' || process.env.WARLOCK_PROFILE === 'true';

/**
 * Initialize the profiler by creating the CSV file with headers if it doesn't exist
 */
export function initializeProfiler() {
	if (!ENABLED) return;

	if (!fs.existsSync(CSV_FILE)) {
		const headers = 'timestamp,host,duration_ms,status,command\n';
		try {
			fs.writeFileSync(CSV_FILE, headers, 'utf-8');
			logger.info(`Profiler initialized: ${CSV_FILE}`);
		} catch (error) {
			logger.error('Failed to initialize profiler CSV file:', error.message);
		}
	}
}

/**
 * Record a command execution metric to the profiler CSV
 * @param {string} host - Target host for the command
 * @param {string} cmd - Command executed
 * @param {number} durationMs - Execution time in milliseconds
 * @param {string} status - 'success' or 'error'
 */
export function recordMetric(host, cmd, durationMs, status = 'success') {
	if (!ENABLED) return;

	const timestamp = new Date().toISOString();
	// Escape quotes in command for CSV
	const escapedCmd = cmd.replace(/"/g, '""');
	const csvLine = `${timestamp},${host},${durationMs},${status},"${escapedCmd}"\n`;

	try {
		fs.appendFileSync(CSV_FILE, csvLine, 'utf-8');
	} catch (error) {
		logger.error('Failed to write profiler metric:', error.message);
	}
}

/**
 * Check if profiler is enabled
 * @returns {boolean}
 */
export function isEnabled() {
	return ENABLED;
}

/**
 * Get the path to the profiler CSV file
 * @returns {string}
 */
export function getProfilerPath() {
	return CSV_FILE;
}

