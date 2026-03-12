const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
const { cmdRunner } = require('../../libs/cmd_runner.mjs');
const { Host } = require('../../db');
const { logger } = require('../../libs/logger.mjs');
const crypto = require('crypto');

const router = express.Router();

// Helper validators
function isValidIdentifier(id) {
	if (!id || typeof id !== 'string') return false;
	// Allow alnum, underscore, dot, colon, dash
	return /^[A-Za-z0-9_.:-]+$/.test(id);
}

function validateSchedule(schedule) {
	if (!schedule || typeof schedule !== 'string') return false;
	const s = schedule.trim();
	if (s.length === 0) return false;
	// Accept either @special or five-field cron (very basic check)
	if (s.startsWith('@')) return true;
	const parts = s.split(/\s+/);
	return parts.length === 5;
}

function hasWarlockTag(line) {
	return line && line.indexOf('#warlock:') !== -1;
}

function parseIdentifier(line) {
	if (!line) return null;
	const m = line.match(/#warlock:id=([A-Za-z0-9_.:-]+)/);
	if (m) {
		return m[1];
	}
	else {
		// Generate a hash of the line to allow updating even without an identifier
		return 'hash:' + crypto.createHash('md5').update(line).digest('hex');
	}
}

/**
 * Get the cron entries for a given host
 *
 * API endpoint: GET /api/cron/:host
 *
 * Returns JSON with success (True/False) and jobs.
 * Each job is an object with the following properties:
 * - raw: The raw crontab line
 * - is_comment: True if the line is a comment
 * - schedule: The cron schedule (or null if not a cron line)
 * - command: The command to run (or null if not a cron line)
 * - identifier: The identifier for the job (or null if not a cron line)
 * - is_warlock: True if the line is a Warlock-specific line (e.g. #warlock:id=...)
 */
router.get('/:host', validate_session, (req, res) => {
	const host = req.params.host;

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		const cmd = "crontab -l 2>/dev/null || true";
		cmdRunner(host, cmd).then(result => {
			const out = (result.stdout || '').split(/\r?\n/);
			const jobs = [];
			for (let line of out) {
				if (!line) continue;
				const is_warlock = hasWarlockTag(line);
				const is_comment = line.trim().startsWith('#');
				const identifier = parseIdentifier(line);
				let schedule = null;
				let command = null;
				// Extract portion before the first #warlock: tag
				const idx = line.indexOf('#warlock:');
				const pre = (idx >= 0) ? line.substring(0, idx).trim() : line.trim();
				if (!is_comment) {
					// Determine schedule and command
					const tokens = pre.split(/\s+/);
					if (tokens[0] && tokens[0].startsWith('@')) {
						schedule = tokens[0];
						command = tokens.slice(1).join(' ').trim() || null;
					} else if (tokens.length >= 6) {
						schedule = tokens.slice(0,5).join(' ');
						command = tokens.slice(5).join(' ').trim() || null;
					} else {
						// Could be malformed; provide raw pre as command
						command = pre || null;
					}
				}
				jobs.push({ raw: line, is_comment, schedule, command, identifier, is_warlock });
			}

			return res.json({ success: true, jobs: jobs });
		}).catch(e => {
			logger.error('Error reading crontab:', e);
			return res.json({ success: false, error: e && e.error ? e.error.message || String(e.error) : String(e) });
		});
	});
});

// POST /api/cron/:host - add or update a job
router.post('/:host', validate_session, (req, res) => {
	const host = req.params.host;
	const { schedule, command, identifier } = req.body || {};

	if (identifier && !isValidIdentifier(identifier)) {
		return res.json({ success: false, error: 'Identifier contains invalid characters' });
	}
	if (!validateSchedule(schedule)) {
		return res.json({ success: false, error: 'Schedule must be a @special or 5-field cron expression' });
	}
	if (!command || typeof command !== 'string' || command.trim().length === 0) {
		return res.json({ success: false, error: 'Command is required' });
	}
	if (command.indexOf('\n') !== -1 || command.indexOf('\r') !== -1) {
		return res.json({ success: false, error: 'Command cannot contain newline characters' });
	}

	const isHash = !identifier || identifier.startsWith('hash:');

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		const readCmd = "crontab -l 2>/dev/null || true";
		cmdRunner(host, readCmd).then(result => {
			const existing = result.stdout || '';
			const timestamp = Date.now();
			const dl = `EOF_${timestamp}`;

			// Iterate over current lines, replacing the line which matches the inbound identifier.
			const lines = existing.split(/\r?\n/).filter(Boolean);
			let matched = false;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const lineIdentifier = parseIdentifier(line);

				if (identifier === lineIdentifier) {
					// Match found; replace this line
					if (isHash) {
						// Hash-based identifiers do not get an ID tag added.
						lines[i] = `${schedule} ${command}`;
					}
					else {
						lines[i] = `${schedule} ${command} #warlock:id=${identifier}`;
					}

					matched = true;
					break;
				}
			}

			if (!matched) {
				// No existing line matched
				if (isHash) {
					// Hash-based identifiers do not get an ID tag added.
					lines.push(`${schedule} ${command}`);
				}
				else {
					lines.push(`${schedule} ${command} #warlock:id=${identifier}`);
				}
			}
			const newCron = lines.join('\n') + '\n';

			// Write new crontab and activate it
			const tmp = `/tmp/warlock_cron_${timestamp}`;
			const writeCmd = `cat > ${tmp} <<${dl}\n${newCron}\n${dl}\ncrontab ${tmp} && rm -f ${tmp}`;
			cmdRunner(host, writeCmd).then(() => {
				return res.json({ success: true });
			}).catch(e => {
				logger.error('Error writing new crontab:', e);
				return res.json({ success: false, error: e && e.error ? e.error.message || String(e.error) : String(e) });
			});
		}).catch(e => {
			logger.error('Error reading existing crontab:', e);
			return res.json({ success: false, error: e && e.error ? e.error.message || String(e.error) : String(e) });
		});
	});
});

// DELETE /api/cron/:host - remove a job by identifier (required)
router.delete('/:host', validate_session, (req, res) => {
	const host = req.params.host;
	const { identifier } = req.body || {};

	if (!identifier) {
		return res.json({ success: false, error: 'Identifier is required' });
	}
	if (!isValidIdentifier(identifier)) {
		return res.json({ success: false, error: 'Identifier contains invalid characters' });
	}

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		const readCmd = "crontab -l 2>/dev/null || true";
		cmdRunner(host, readCmd).then(result => {
			const existing = result.stdout || '';
			const timestamp = Date.now();
			const dl = `EOF_${timestamp}`;

			// Iterate over current lines, replacing the line which matches the inbound identifier.
			const lines = existing.split(/\r?\n/).filter(Boolean);
			let matched = false,
				newLines = [];
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const lineIdentifier = parseIdentifier(line);

				if (identifier === lineIdentifier) {
					// Match found; skip
					matched = true;
				}
				else {
					newLines.push(lines[i]);
				}
			}

			if (!matched) {
				return res.json({ success: false, error: 'No cron job found with the specified identifier' });
			}
			const newCron = newLines.join('\n') + '\n';

			// Write new crontab and activate it
			const tmp = `/tmp/warlock_cron_${timestamp}`;
			const writeCmd = `cat > ${tmp} <<${dl}\n${newCron}\n${dl}\ncrontab ${tmp} && rm -f ${tmp}`;
			cmdRunner(host, writeCmd).then(() => {
				return res.json({ success: true });
			}).catch(e => {
				logger.error('Error writing new crontab:', e);
				return res.json({ success: false, error: e && e.error ? e.error.message || String(e.error) : String(e) });
			});
		}).catch(e => {
			logger.error('Error reading existing crontab:', e);
			return res.json({ success: false, error: e && e.error ? e.error.message || String(e.error) : String(e) });
		});
	});
});

module.exports = router;

