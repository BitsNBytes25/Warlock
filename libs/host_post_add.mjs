/**
 * Operations required to be performed on hosts as soon as they are added.
 *
 * Most systems are functional out-of-the-box, but this ensures that all will be fully prepared.
 *
 * @module host_post_add
 */
import {cmdRunner} from "./cmd_runner.mjs";

export async function hostPostAdd(host) {
	return new Promise((resolve, reject) => {
		// Ensure `file` is installed.  Most distros have it by default, but some minimal installs may not.
		// This is required for proper OS detection later.
		const installFileCmds = {
			'debian': 'which -s file || apt-get install -y file',
			'ubuntu': 'which -s file ||  apt-get install -y file',
			'centos': 'which -s file || yum install -y file',
			'rocky': 'which -s file || yum install -y file',
			'almalinux': 'which -s file || yum install -y file',
			'amazon linux': 'which -s file || yum install -y file',
			'fedora': 'which -s file || dnf install -y file',
			'arch': 'which -s file || pacman -Sy --noconfirm file',
		};

		// Query the server for the OS type; this will determine which install command to use.
		cmdRunner(host, 'lsb_release -i 2>/dev/null | sed "s#.*:\\t##"')
			.then(result => {
				const osRelease = result.stdout.toLowerCase();
				if (installFileCmds[osRelease]) {
					return cmdRunner(host, installFileCmds[osRelease]);
				}
				else {
					reject('Could not determine OS type for host; cannot install required packages.');
				}
			});
	});
}