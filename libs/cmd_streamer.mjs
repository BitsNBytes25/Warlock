import {Host} from "../db.js";
import {spawn} from 'child_process';
import {logger} from "./logger.mjs";

/**
 * Stream command output via SSE from target host
 *
 * @param {string} target
 * @param {string} cmd
 * @param {Response} res
 */
export async function cmdStreamer(target, cmd, res) {
	// Set headers for streaming plain text (can be consumed as EventSource or plain text chunks)
	res.writeHead(200, {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive'
	});

	const hostLookup = await Host.count({where: {ip: target}});
	if (hostLookup === 0) {
		res.write(`event: error\ndata: Target host '${target}' not found in database.\n\n`);
		res.end();
		return;
	}

	let spawnCommand, spawnArgs;

	if (target === 'localhost' || target === '127.0.0.1') {
		// For localhost we need to run the command using a local shell so arbitrary
		// bash expressions, pipes, redirects, etc. will work. Use `bash -lc` which
		// runs the command string through a login-ish shell; fall back to `sh -c`
		// if bash is not available on the system.
		spawnCommand = 'bash';
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
			'bash', '-lc', cmd
		];
	}

	// Spawn the command process - spawn requires a program (string) as first arg
	logger.debug(`Spawning command: ${spawnCommand} ${spawnArgs.join(' ')}`);
	const process = spawn(spawnCommand, spawnArgs);

	// Helper to send data to client as SSE data: lines prefixed with "data: " and double newline
	function sendData(chunk) {
		const lines = String(chunk).split(/\r?\n/);
		for (const line of lines) {
			if (line.length === 0) continue;
			res.write(`data: ${line}\n\n`);
		}
	}

	process.stdout.on('data', (chunk) => sendData(chunk));
	process.stderr.on('data', (chunk) => sendData(chunk));

	process.on('close', (code, signal) => {
		logger.debug('close', code, signal);
		res.write(`event: done\ndata: exit ${code}${signal ? ' signal ' + signal : ''}\n\n`);
		res.end();
	});

	process.on('error', (err) => {
		logger.error('Process error:', err);
		res.write(`event: error\ndata: ${err.message}\n\n`);
		res.end();
	});
}
