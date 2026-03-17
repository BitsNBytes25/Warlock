import {exec} from 'child_process';
import {createHash} from 'crypto';
import {Host} from "../db.js";
import {logger} from "./logger.mjs";
import cache, {tagCacheKey} from "./cache.mjs";
import {recordMetric} from "./cmd_profiler.mjs";

/**
 * Run a command via SSH on the target host
 *
 * @param target {string}
 * @param cmd {string}
 * @param cacheable {boolean|int} Number > 0 if the result of this command should be cached for N seconds.
 * @param cacheTag {string|strings[]|null} Optional tag to use for cache tracking.
 * @returns {Promise<{stdout: string, stderr: string}>|Promise<{error: Error, stdout: string, stderr: string}>}
 */
export async function cmdRunner(target, cmd, cacheable = false, cacheTag = null) {
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
					stderr: cachedResult.stderr
				});
			}
		}

		// Confirm the host exists in the database first
		Host.count({where: {ip: target}}).then(count => {
			let sshCommand = null,
				cmdOptions = {timeout: 30000, maxBuffer: 1024 * 1024 * 20},
				isSSH = false;

			if (count === 0) {
				const duration = Math.round(performance.now() - startTime);
				recordMetric(target, cmd, duration, 'error');
				return reject({
					error: new Error(`Target host '${target}' not found in database.`),
					stdout: '',
					stderr: ''
				});
			}

			logger.debug('cmdRunner: Executing command on ' + target, cmd);
			if (target === 'localhost' || target === '127.0.0.1') {
				sshCommand = cmd; // No SSH needed for localhost
			} else {
				// Escape single quotes in the remote command to avoid breaking the SSH command
				sshCommand = cmd.replace(/'/g, "'\\''");
				sshCommand = `ssh -o LogLevel=quiet -o StrictHostKeyChecking=no -o PasswordAuthentication=no root@${target} '${sshCommand}'`;
				isSSH = true;
			}

			exec(sshCommand, cmdOptions, (error, stdout, stderr) => {
				const duration = Math.round(performance.now() - startTime);

				if (error) {
					logger.debug('cmdRunner exit code:', error.code);
					recordMetric(target, cmd, duration, 'error');

					if (isSSH && error.code === 255 && stderr === '') {
						// This is the scenario for when SSH cannot connect to the host.
						// Set stderr to something more meaningful.
						stderr = 'Cannot connect to the host via SSH.';
					}

					if (stderr) {
						logger.debug('cmdRunner stderr:', stderr);
						// Remap the error to the actual stderr text.
						// This is done because most errors will be something generic like "command exited with non-zero code"
						return reject({error: new Error(stderr), stdout, stderr});
					}
					else {
						return reject({error, stdout, stderr});
					}
				}

				recordMetric(target, cmd, duration, 'success');
				const result = {stdout, stderr};

				// Store in cache if cacheable
				if (cacheable) {
					if (cacheable === true) {
						cacheable = 86400; // Convert to a time (in seconds) if True
					}
					if (typeof cacheable === 'number' && cacheable > 0) {
						cache.set(cacheKey, {stdout, stderr}, cacheable);
						tagCacheKey(cacheKey, target, cacheTag);
						logger.debug('cmdRunner: Cached result for', cacheKey);
					}
				}

				logger.debug('cmdRunner:', stdout);
				resolve(result);
			});
		});
	});
}
