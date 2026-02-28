import {exec} from 'child_process';
import {createHash} from 'crypto';
import {Host} from "../db.js";
import {logger} from "./logger.mjs";
import cache from "./cache.mjs";
import {recordMetric} from "./cmd_profiler.mjs";

/**
 * Run a command via SSH on the target host
 *
 * @param target {string}
 * @param cmd {string}
 * @param extraFields {*}
 * @param cacheable {boolean|int} Number > 0 if the result of this command should be cached for N seconds.
 * @returns {Promise<{stdout: string, stderr: string, extraFields: *}>|Promise<{error: Error, stdout: string, stderr: string, extraFields: *}>}
 */
export async function cmdRunner(target, cmd, extraFields = {}, cacheable = false) {
	return new Promise((resolve, reject) => {
		const startTime = performance.now();
		// Generate cache key from host and command
		const cacheKey = createHash('sha256').update(`${target}:${cmd}`).digest('hex');

		// Check cache if cacheable
		if (cacheable) {
			const cachedResult = cache.get(cacheKey);
			if (cachedResult) {
				logger.debug(`cmdRunner: Cache hit on ${target} for ${cmd}`);
				const duration = Math.round(performance.now() - startTime);
				recordMetric(target, cmd, duration, 'CACHED');
				return resolve({
					stdout: cachedResult.stdout,
					stderr: cachedResult.stderr,
					extraFields: extraFields
				});
			}
		}

		// Confirm the host exists in the database first
		Host.count({where: {ip: target}}).then(count => {
			let sshCommand = null,
				cmdOptions = {timeout: 30000, maxBuffer: 1024 * 1024 * 20};

			if (count === 0) {
				const duration = Math.round(performance.now() - startTime);
				recordMetric(target, cmd, duration, 'error');
				return reject({
					error: new Error(`Target host '${target}' not found in database.`),
					stdout: '',
					stderr: '',
					extraFields
				});
			}

			logger.debug('cmdRunner: Executing command on ' + target, cmd);
			if (target === 'localhost' || target === '127.0.0.1') {
				sshCommand = cmd; // No SSH needed for localhost
			} else {
				// Escape single quotes in the remote command to avoid breaking the SSH command
				sshCommand = cmd.replace(/'/g, "'\\''");
				sshCommand = `ssh -o LogLevel=quiet -o StrictHostKeyChecking=no root@${target} '${sshCommand}'`;
			}

			exec(sshCommand, cmdOptions, (error, stdout, stderr) => {
				const duration = Math.round(performance.now() - startTime);

				if (error) {
					logger.debug('cmdRunner exit code:', error.code);
					recordMetric(target, cmd, duration, 'error');
					if (stderr) {
						logger.debug('cmdRunner stderr:', stderr);
						return reject({error: new Error(stderr), stdout, stderr, extraFields});
					}
					else {
						return reject({error, stdout, stderr, extraFields});
					}
				}

				recordMetric(target, cmd, duration, 'success');
				const result = {stdout, stderr, extraFields};

				// Store in cache if cacheable
				if (cacheable) {
					if (cacheable === true) {
						cacheable = 300; // Default to 5 minutes if true
					}
					if (typeof cacheable === 'number' && cacheable > 0) {
						cache.set(cacheKey, {stdout, stderr}, cacheable);
						logger.debug('cmdRunner: Cached result for', cacheKey);
					}
				}

				logger.debug('cmdRunner:', stdout);
				resolve(result);
			});
		});
	});
}
