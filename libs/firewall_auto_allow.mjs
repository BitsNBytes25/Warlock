import path from "path";
import {execSync} from "child_process";

/**
 * Auto-add the necessary firewall rules to preserve access to Warlock.
 *
 * Used anytime a firewall is installed on localhost.
 *
 * @param req
 */
export function firewallAutoAllow(req) {
	const script = path.join(process.cwd(), 'scripts', 'linux_util_firewall_allow.sh'),
		connectionHost = req.headers.host;
	if (connectionHost.includes(':')) {
		// An explicit port is used in the web connection; allow that to preserve access.
		const connectionPort = connectionHost.split(':')[1];

		execSync(`${script} --port ${connectionPort} --comment "Access to Warlock"`);
	}
	else {
		// No explicit port is used, presume default web ports
		execSync(`${script} --port 80 --comment "Access to Warlock (HTTP)"`);
		execSync(`${script} --port 443 --comment "Access to Warlock (HTTPS)"`);
	}
}