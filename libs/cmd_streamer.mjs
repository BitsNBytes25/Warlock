import {Host} from "../db.js";
import {spawn} from 'child_process';
import {logger} from "./logger.mjs";

/**
 * Stream command output via SSE from target host
 *
 * @param {string} target
 * @param {string} cmd
 * @param {Response} res
 * @param {boolean} ignoreClose Set to true to ignore client disconnects (default: false)
 */
export async function cmdStreamer(target, cmd, res, ignoreClose = false) {
	return new Promise(async (resolve, reject) => {
		// Set headers for streaming plain text (can be consumed as EventSource or plain text chunks)
		res.writeHead(200, {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive'
		});

		const req = res.req;
		const hostLookup = await Host.count({where: {ip: target}});
		let spawnCommand, spawnArgs, clientGone = false;

		if (hostLookup === 0) {
			res.write(`event: error\ndata: Target host '${target}' not found in database.\n\n`);
			res.end();
			return reject();
		}

		if (target === 'localhost' || target === '127.0.0.1') {
			// For localhost we need to run the command using a local shell so arbitrary
			// bash expressions, pipes, redirects, etc. will work. Use `bash -lc` which
			// runs the command string through a login-ish shell; fall back to `sh -c`
			// if bash is not available on the system.
			spawnCommand = '/usr/bin/bash';
			spawnArgs = ['-lc', cmd];
		} else {
			// Run the remote command under bash on the remote host so complex shell
			// constructs (pipes, redirects, &&, etc.) don't require fragile quoting.
			// Using separate args for ssh prevents local shell escaping issues.
			spawnCommand = 'ssh';
			spawnArgs = [
				'-o', 'LogLevel=quiet',
				'-o', 'StrictHostKeyChecking=no',
				`root@${target}`,
				'bash', '-lc', `'${cmd}'`
			];
		}

		// Spawn the command process - spawn requires a program (string) as first arg
		logger.debug(`Spawning command: ${spawnCommand} ${spawnArgs.join(' ')}`);
		const process = spawn(spawnCommand, spawnArgs);

		// Helper to send data to client as SSE data: lines prefixed with "data: " and double newline
		const sendData = (pipe, chunk) => {
			const lines = String(chunk).split(/\r?\n/);
			for (const line of lines) {
				if (line.length === 0) continue;
				if (clientGone) return;
				res.write(`${pipe}: ${line}\n\n`);
			}
		};

		const onClientClose = () => {
			if (clientGone) return;
			clientGone = true;

			if (ignoreClose) {
				logger.debug('Client disconnected, but ignoring as per flag');
				return;
			}

			logger.debug('Client disconnected, killing process');
			try {
				if (!process.killed) {
					process.kill();
				}
			} catch (e) {
				// Ignore
			}
		};

		const cleanupListeners = () => {
			req.removeListener('close', onClientClose);
			req.removeListener('aborted', onClientClose);
			res.removeListener('close', onClientClose);
		};

		process.stdout.on('data', (chunk) => sendData('stdout', chunk));
		process.stderr.on('data', (chunk) => sendData('stderr', chunk));

		process.on('close', (code, signal) => {
			logger.debug('close', code, signal);
			cleanupListeners();
			if (clientGone) return;

			if (code !== 0) {
				res.write(`event: error\ndata: Exit code of ${code} indicated an error\n\n`);
				res.end();
				reject();
			}
			else {
				res.write(`event: done\ndata: exit ${code}${signal ? ' signal ' + signal : ''}\n\n`);
				res.end();
				resolve();
			}
		});

		process.on('error', (err) => {
			logger.error('Process error:', err);
			cleanupListeners();
			if (clientGone) return;

			res.write(`event: error\ndata: ${err.message}\n\n`);
			res.end();
			reject();
		});

		// Track client disconnects
		req.on('close', onClientClose);
		req.on('aborted', onClientClose);
		res.on('close', onClientClose);
	});
}
