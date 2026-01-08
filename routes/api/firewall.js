const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const { cmdRunner } = require("../../libs/cmd_runner.mjs");
const { Host } = require('../../db');
const { logger } = require('../../libs/logger.mjs');
const {buildRemoteExec} = require("../../libs/build_remote_exec.mjs");

const router = express.Router();

/**
 * Build the UFW command options for rule addition/deletion
 *
 * Should go inside the ufw (insert 1) and comment addition at the end, (to support both add and delete).
 *
 * @param to
 * @param from
 * @param proto
 * @param action
 */
function buildUFWOptions(to, from, proto, action) {

	if (to === null || to === '' || to === undefined) {
		to = 'any';
	}
	if (from === null || from === '' || from === undefined) {
		from = 'any';
	}

	let cmd = [];

	// First part of the rule, allow/deny/reject
	cmd.push(`${action.toLowerCase()}`);

	// Add from declaration
	cmd.push(`from ${from}`);

	if (to === 'any') {
		// Any local IP address and any port
		cmd.push(`to ${to}`);
	}
	else {
		// Any local IP address but a specific port or port range.
		cmd.push('to any');
		cmd.push(`port ${to}`);
	}

	// Add protocol if specified
	if (proto) {
		cmd.push(`proto ${proto}`);
	}

	return cmd.join(' ');
}

// GET status
router.get('/:host', validate_session, (req, res) => {
	const host = req.params.host;

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		let rules = [],
			status = 'unknown';

		cmdRunner(host, 'which ufw && ufw status || echo "Status: NOT INSTALLED"').then(result => {
			result.stdout.split('\n').forEach(line => {
				line = line.trim();
				if (line.startsWith('Status:')) {
					status = line.split(':')[1].trim();
				}
				else if (line === '' || line.startsWith('To ') || line.startsWith('--')) {
					// Skip
				}
				else {
					let rule = {
						to: null,
						from: null,
						proto: null,
						action: null,
						comment: null,
					}

					// Extract out the comment first since that's an easy find.
					if (line.includes('# ')) {
						rule.comment = line.substring(line.indexOf('# ') + 2);
						line = line.substring(0, line.indexOf('# ')).trim();
					}
					let parts = line.split(/\s+/), to, from;

					if (parts.length === 3) {
						to = parts[0];
						rule.action = parts[1];
						from = parts[2];
					}
					else if (parts.length === 5) {
						// Skip IPV6 (they're just copies of IPV4 rules usually)
						return;
					}
					else {
						logger.warn('Unrecognized ufw rule format:', line);
						return;
					}

					// to and from may contain proto like 22/tcp
					// This is done the long way because to/from may also contain /NN for CIDR ranges.
					if (to.includes('/tcp')) {
						to = to.replace('/tcp', '');
						rule.proto = 'tcp';
					}
					else if (to.includes('/udp')) {
						to = to.replace('/udp', '');
						rule.proto = 'udp';
					}
					if (from.includes('/tcp')) {
						from = from.replace('/tcp', '');
						rule.proto = 'tcp';
					}
					else if (from.includes('/udp')) {
						from = from.replace('/udp', '');
						rule.proto = 'udp';
					}

					if (to === 'Anywhere') {
						rule.to = 'any';
					}
					else {
						rule.to = to;
					}

					if (from === 'Anywhere') {
						rule.from = 'any';
					}
					else {
						rule.from = from;
					}

					rules.push(rule);
				}
			});

			return res.json({ success: true, status, rules });
		}).catch(err => {
			logger.error('Error fetching ufw status:', err);
			return res.json({ success: false, error: 'Unable to fetch UFW status' });
		});
	});
});

// POST add rule
router.post('/:host', validate_session, (req, res) => {
	const host = req.params.host;
	const {to, from, proto, action, comment} = req.body;

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		let cmd = 'ufw';

		if (['ALLOW', 'DENY', 'REJECT'].indexOf(action) === -1) {
			return res.json({ success: false, error: 'Invalid action; must be ALLOW, DENY, or REJECT' });
		}

		if (action === 'DENY' || action === 'REJECT') {
			// DENY/REJECT rules always should go at the top.
			cmd += ' insert 1';
		}

		cmd += ' ' + buildUFWOptions(to, from, proto, action);

		if (cmd.endsWith('from any to any')) {
			return res.json({ success: false, error: `Rule too broad; refusing to ${action} from ANY to ANY` });
		}

		// Add comment if provided
		if (comment && comment.trim().length > 0) {
			// Sanitize comment to avoid shell injection
			const safeComment = comment.replace(/["`\\]/g, '');
			cmd += ` comment "${safeComment}"`;
		}

		// Execute
		cmdRunner(host, cmd).then(result => {
			return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
		}).catch(e => {
			logger.error('Error adding ufw rule:', e);
			return res.json({ success: false, error: 'Failed to add rule' });
		});
	});
});

// DELETE remove rule by spec
router.delete('/:host', validate_session, (req, res) => {
	const host = req.params.host;
	const {to, from, proto, action} = req.body;

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		let cmd = 'ufw delete';

		if (['ALLOW', 'DENY', 'REJECT'].indexOf(action) === -1) {
			return res.json({ success: false, error: 'Invalid action; must be ALLOW, DENY, or REJECT' });
		}

		cmd += ' ' + buildUFWOptions(to, from, proto, action);

		// Execute
		cmdRunner(host, cmd).then(result => {
			return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
		}).catch(e => {
			logger.error('Error removing ufw rule:', e);
			return res.json({ success: false, error: 'Failed to remove rule' });
		});
	});
});

// Enable/disable
router.post('/enable/:host', validate_session, (req, res) => {
	const host = req.params.host;
	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		cmdRunner(host, 'which ufw && ufw --force enable || echo "UFW is not installed, cannot enable"')
			.then(result => {
				return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
			}).catch(e => {
				logger.error('Error enabling ufw:', e);
				return res.json({ success: false, error: 'Failed to enable UFW' });
			});
	});
});

router.post('/disable/:host', validate_session, (req, res) => {
	const host = req.params.host;
	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		cmdRunner(host, 'which ufw && ufw --force disable || echo "UFW is not installed, cannot disable"')
			.then(result => {
				return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
			}).catch(e => {
				logger.error('Error enabling ufw:', e);
				return res.json({ success: false, error: 'Failed to disable UFW' });
			});
	});
});

router.post('/install/:host', validate_session, (req, res) => {
	const host = req.params.host;
	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({ success: false, error: 'Requested host is not in the configured HOSTS list' });
		}

		let cmdData = buildRemoteExec('https://raw.githubusercontent.com/eVAL-Agency/ScriptsCollection/refs/heads/main/dist/ufw/linux_install_ufw.sh');

		cmdRunner(host, cmdData.cmd)
			.then(result => {
				return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
			}).catch(e => {
			logger.error('Error installing ufw:', e);
			return res.json({ success: false, error: 'Failed to installing UFW' });
		});
	});
});

module.exports = router;
