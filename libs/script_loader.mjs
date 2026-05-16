import {cmdRunner} from "./cmd_runner.mjs";
import {filePushRunner} from "./file_push_runner.mjs";
import path from "path";
import crypto from "crypto";


/**
 * Script loader to retrieve a remote or local script to a host and ensure it is executable
 *
 * Mimics buildRemoteExec to generate a full command, but transfers the script instead of streaming it.
 *
 * @param {string} host
 * @param {string} url
 * @param {Array<string>} args
 */
export const scriptLoader = async (host, url, args = []) => {
	// Check if the "URL" is a local script file or a remote URL.
	const scriptLocal = url.startsWith(path.join(process.cwd(), 'scripts'));

	// Check if the target host is local or remote
	const targetLocal = (host === 'localhost' || host === '127.0.0.1');

	// Path to the destination script on the target server
	let scriptPath;

	let flags = [],
		parameters = [],
		positionalParameters = [],
		namedParameters = {},
		cmdFlags = '';

	// Append any additional options as CLI flags
	args.forEach(arg => {
		if (/^[-]+[a-zA-Z][a-zA-Z0-9_\-+\/\.]*=.*$/.test(arg)) {
			// Argument in the format of --key=value
			const [key, value] = arg.split('=');
			flags.push(`${key}="${value.replace(/"/g, '\\"')}"`);
			namedParameters[key] = value;
			parameters.push(`${key}=${value}`);
		}
		else if (/^[-]+[a-zA-Z][a-zA-Z0-9_\-+\/\.]*$/.test(arg)) {
			// Argument in the format of --flag
			flags.push(`${arg}`);
			namedParameters[arg] = null;
			parameters.push(`${arg}`);
		}
		else {
			// Positional parameter
			if (arg.includes(' ') || arg.includes('"')) {
				// Escape double quotes and wrap in double quotes
				flags.push(`"${arg.replace(/"/g, '\\"')}"`);
			}
			else {
				flags.push(`${arg}`);
			}
			positionalParameters.push(arg);
			parameters.push(`${arg}`);
		}
	});

	if (flags.length > 0) {
		cmdFlags = ' ' + flags.join(' ');
	}

	if (scriptLocal && targetLocal) {
		// Script is local and target is local; just ensure it's executable and return the original script.
		await cmdRunner(host, `chmod +x "${url}"`);
		return {
			url,
			cmd: url + cmdFlags,
			positionalParameters,
			namedParameters,
			parameters
		};
	}

	if (!scriptLocal && !url.startsWith('https://')) {
		throw new Error('Refusing to load a non-HTTPS script URL.');
	}

	if (scriptLocal) {
		scriptPath = '/opt/warlock/' + path.basename(url);
	}
	else {
		const scriptHash = crypto.createHash('md5').update(url).digest('hex');
		scriptPath = `/opt/warlock/${scriptHash}.sh`;
	}

	// Ensure the target payload directory exists; we'll just use /opt/warlock to keep everything together.
	await cmdRunner(host, '[ -d /opt/warlock ] || mkdir -p /opt/warlock');

	if (scriptLocal) {
		// Perform the request on the remote host, but first we need to transfer the install script over there.
		await filePushRunner(host, url, scriptPath);
	}
	else {
		// Perform a download to retrieve the script
		const downloadCmd = `if command -v curl >/dev/null 2>&1; then curl --connect-timeout 10 --retry 3 --retry-delay 10 -fsL "${url}" -o "${scriptPath}"; ` +
			`elif command -v wget >/dev/null 2>&1; then wget -q "${url}" -O "${scriptPath}"; ` +
			`else echo "ERROR: neither curl nor wget is available on the target host" >&2; exit 2; fi`;
		await cmdRunner(host, downloadCmd);
	}

	// Ensure the script is executable
	await cmdRunner(host, `chmod +x "${scriptPath}"`);

	return {
		url,
		cmd: scriptPath + cmdFlags,
		positionalParameters,
		namedParameters,
		parameters
	};
}