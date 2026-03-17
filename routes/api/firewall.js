const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const { cmdRunner } = require("../../libs/cmd_runner.mjs");
const { Host } = require('../../db');
const { logger } = require('../../libs/logger.mjs');
const {buildRemoteExec} = require("../../libs/build_remote_exec.mjs");
const {clearTaggedCache} = require("../../libs/cache.mjs");
const {validateHost} = require("../../libs/validate_host.mjs");
const path = require('path');
const {firewallAutoAllow} = require("../../libs/firewall_auto_allow.mjs");
const {filePushRunner} = require("../../libs/file_push_runner.mjs");

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
	let {to, from, proto, action, comment} = req.body;

	if (!action) {
		return res.json({ success: false, error: 'Action is required to add a rule' });
	}

	action = action.toUpperCase();

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
	let {to, from, proto, action} = req.body;

	if (!action) {
		return res.json({ success: false, error: 'Action is required to add a rule' });
	}

	action = action.toUpperCase();

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
				clearTaggedCache(host, 'overview');
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
				clearTaggedCache(host, 'overview');
				return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
			}).catch(e => {
				logger.error('Error enabling ufw:', e);
				return res.json({ success: false, error: 'Failed to disable UFW' });
			});
	});
});

router.post(
	'/install/:host',
	validate_session,
	validateHost,
	async (req, res) => {
		const script = path.join(process.cwd(), 'scripts', 'linux_install_firewall.sh');

		if (req.hostData.host === 'localhost' || req.hostData.host === '127.0.0.1') {
			// Perform operations for localhost; they'll be slightly different than remote hosts.

			// Ensure file is executable; it should be already, but just check.
			await cmdRunner(req.hostData.host, 'chmod +x ' + script);

			// Run the script to install the appropriate firewall.
			cmdRunner(req.hostData.host, script).then(result => {
				// Since we're performing this operation on the host where Warlock resides,
				// we want to ensure the user still has access to Warlock once the firewall is enabled.
				firewallAutoAllow(req);
				return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
			}).catch(e => {
				logger.error('Error installing firewall:', e);
				return res.json({ success: false, error: 'Failed to install firewall' });
			});
		}
		else {
			// Ensure the target payload directory exists; we'll just use /opt/warlock to keep everything together.
			await cmdRunner(req.hostData.host, '[ -d /opt/warlock ] || mkdir -p /opt/warlock');

			// Perform the request on the remote host, but first we need to transfer the install script over there.
			await filePushRunner(req.hostData.host, script, '/opt/warlock/linux_install_firewall.sh');

			// Now we can run the script
			cmdRunner(req.hostData.host, 'chmod +x /opt/warlock/linux_install_firewall.sh && /opt/warlock/linux_install_firewall.sh').then(result => {
				// The script already handles ensuring access from Warlock,
				// and the user will be able to add addition rules if necessary.
				return res.json({ success: true, stdout: result.stdout, stderr: result.stderr });
			}).catch(e => {
				logger.error('Error installing firewall:', e);
				return res.json({ success: false, error: 'Failed to install firewall' });
			});
		}
	}
);

module.exports = router;
