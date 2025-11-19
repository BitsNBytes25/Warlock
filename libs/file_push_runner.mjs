/*const { exec } = require('child_process');
const {Host} = require("../db");
const {logger} = require("./logger");
const {cmdRunner} = require("./cmd_runner");*/
import { exec } from 'child_process';
import { Host } from "../db.js";
import { logger } from "./logger.mjs";
import { cmdRunner } from "./cmd_runner.mjs";

/**
 * Push a local file to a remote target via SCP
 * or copy locally if target is localhost
 *
 * @param {string} target Target hostname or IP address
 * @param {string} localFileName Local source file, (usually within /tmp)
 * @param {string} remoteFileName Fully resolved pathname of target file
 * @param {boolean} pullFile PULL file from remote server instead of pushing
 * @param extraFields {*}
 * @returns {Promise<{stdout: string, stderr: string, extraFields: *}>|Promise<{error: Error, stdout: string, stderr: string, extraFields: *}>}
 */
export async function filePushRunner(target, localFileName, remoteFileName, pullFile = false, extraFields = {}) {
	return new Promise((resolve, reject) => {
		// Confirm the host exists in the database first
		Host.count({where: {ip: target}})
			.then(count => {
				let sshCommand = null,
					cmdOptions = {timeout: 120000, maxBuffer: 1024 * 1024 * 20},
					permissionCmd = `chown $(stat -c%U "$(dirname "${remoteFileName}")"):$(stat -c%U "$(dirname "${remoteFileName}")") "${remoteFileName}"`;

				if (count === 0) {
					return reject({
						error: new Error(`Target host '${target}' not found in database.`),
						stdout: '',
						stderr: '',
						extraFields
					});
				}

				if (target === 'localhost' || target === '127.0.0.1') {
					if (pullFile) {
						sshCommand = `cp "${remoteFileName}" "${localFileName}"`;
					}
					else {
						sshCommand = `cp "${localFileName}" "${remoteFileName}"`;
					}
					logger.debug('filePushRunner: Copying local file', remoteFileName);
				} else {
					if (pullFile) {
						sshCommand = `scp -o LogLevel=quiet -o StrictHostKeyChecking=no root@${target}:"${remoteFileName}" "${localFileName}"`;
						logger.debug('filePushRunner: Pulling file from ' + target, remoteFileName);
					}
					else {
						sshCommand = `scp -o LogLevel=quiet -o StrictHostKeyChecking=no "${localFileName}" root@${target}:"${remoteFileName}"`;
						logger.debug('filePushRunner: Pushing file to ' + target, remoteFileName);
					}
				}

				exec(sshCommand, cmdOptions, (error, stdout, stderr) => {
					if (error) {
						logger.error('filePushRunner: Received error:', stderr || error);
						if (stderr) {
							return reject({error: new Error(stderr), stdout, stderr, extraFields});
						} else {
							return reject({error, stdout, stderr, extraFields});
						}
					}

					logger.debug('filePushRunner: file transfer completed');
					if (pullFile) {
						return resolve({stdout, stderr, extraFields});
					}
					else {
						// Now that the file is uploaded, ssh to the host to change the ownership to the correct user.
						// We have no way of knowing exactly which user should have access,
						// but we can guess based on the parent directory.
						cmdRunner(target, permissionCmd)
							.then(dat => {
								return resolve({
									stdout: stdout + dat.stdout,
									stderr: stderr + dat.stderr,
									extraFields
								});
							})
							.catch(e => {
								return reject(e);
							});
					}
				});
			});
	});
}
