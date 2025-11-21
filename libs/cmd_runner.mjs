import {exec} from 'child_process';
import {Host} from "../db.js";
import {logger} from "./logger.mjs";

/**
 * Run a command via SSH on the target host
 *
 * @param target {string}
 * @param cmd {string}
 * @param extraFields {*}
 * @returns {Promise<{stdout: string, stderr: string, extraFields: *}>|Promise<{error: Error, stdout: string, stderr: string, extraFields: *}>}
 */
export async function cmdRunner(target, cmd, extraFields = {}) {
	return new Promise((resolve, reject) => {
		// Confirm the host exists in the database first
		Host.count({where: {ip: target}}).then(count => {
			let sshCommand = null,
				cmdOptions = {timeout: 30000, maxBuffer: 1024 * 1024 * 20};

			if (count === 0) {
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
				if (error) {
					logger.error('cmdRunner: Received error:', stderr || error);
					if (stderr) {
						return reject({error: new Error(stderr), stdout, stderr, extraFields});
					} else {
						return reject({error, stdout, stderr, extraFields});
					}
				}

				logger.debug('cmdRunner:', stdout);
				resolve({stdout, stderr, extraFields});
			});
		});
	});
}
