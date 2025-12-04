import os from 'os';
import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';

/**
 * Get the public authorization key for the user this service is running as
 *
 * Used to provide the user with feedback on how to set up their host for communication.
 *
 * @return {string} The contents of the public SSH key
 * @throws {Error} If no key could be found or auto-generated
 */
export function get_ssh_key() {
	const sshDir = path.join(os.homedir(), '.ssh');
	const keys = ['id_ecdsa.pub', 'id_rsa.pub', 'id_dsa.pub', 'id_ed25519.pub'];
	let pubKeyPath = null;

	if (!fs.existsSync(sshDir)) {
		// Auto-create directory if it does not exist
		fs.mkdirSync(sshDir, {mode: 0o700});
	}

	for (let key of keys) {
		const keyPath = path.join(sshDir, key);
		if (fs.existsSync(keyPath)) {
			pubKeyPath = keyPath;
			break;
		}
	}

	if (pubKeyPath === null) {
		// Auto-create an ECDSA key by default
		const keyPath = path.join(sshDir, 'id_ecdsa');
		execSync(`ssh-keygen -q -t ecdsa -b 521 -f "${keyPath}" -N "" -C "warlock-generated-key"`);
		pubKeyPath = keyPath + '.pub';
	}

	let data = fs.readFileSync(pubKeyPath, 'utf8');
	return data.trim();
}