/**
 * Builds a shell command to execute a remote script from a given URL.
 *
 * @param {string} url
 * @param {Array<string>} args
 * @returns {{url: string, cmd: string, positionalParameters: Array<string>, namedParameters: Object, parameters: Array<string>}}
 */
export function buildRemoteExec(url, args = []) {
	// Safely escape any single quotes in the URL for embedding in single-quoted shell literals
	const escapedUrl = String(url).replace(/'/g, "'\\''");

	let flags = [],
		parameters = [],
		positionalParameters = [],
		namedParameters = {},
		cmd;

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

	// Build a command that streams the installer directly into bash to avoid writing to /tmp
	// It prefers curl, falls back to wget, and prints a clear error if neither is available.
	cmd = `if command -v curl >/dev/null 2>&1; then curl -fsSL "${escapedUrl}"; ` +
		`elif command -v wget >/dev/null 2>&1; then wget -qO- "${escapedUrl}"; ` +
		`else echo "ERROR: neither curl nor wget is available on the target host" >&2; exit 2; fi | bash -s --`;
	if (flags.length > 0) {
		cmd += ' ' + flags.join(' ');
	}

	return {
		url, cmd, positionalParameters, namedParameters, parameters
	};
}
