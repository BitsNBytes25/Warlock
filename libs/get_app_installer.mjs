/**
 * Get the URL to the installer for a given app
 *
 * @param {AppData} app
 */
export async function getAppInstaller(app) {
	if (!app) return null;

	// If installer is already a full URL, return it directly
	if (app.installer && /^https?:\/\//i.test(app.installer)) {
		return app.installer;
	}

	// Only github source is supported by this helper
	if (!app.source || app.source.toLowerCase() !== 'github' || !app.repo) {
		// If installer is a relative path but no github info, return null
		return null;
	}

	// Determine ref (branch / tag / commit)
	let ref = (app.branch || 'main');

	const fetchOptions = {};
	// If a GitHub token is provided in env, use it to increase rate limits
	if (process && process.env && process.env.GITHUB_TOKEN) {
		fetchOptions.headers = {
			'Authorization': `token ${process.env.GITHUB_TOKEN}`,
			'User-Agent': 'warlock-app'
		};
	} else {
		fetchOptions.headers = { 'User-Agent': 'warlock-app' };
	}

	// If branch is RELEASE, ask GitHub for the latest release tag
	if (String(ref).toUpperCase() === 'RELEASE') {
		try {
			const apiUrl = `https://api.github.com/repos/${app.repo}/releases/latest`;
			const resp = await fetch(apiUrl, fetchOptions);
			if (resp.ok) {
				const json = await resp.json();
				if (json && json.tag_name) {
					ref = json.tag_name;
				} else {
					// Fallback to repository default branch
					const repoInfo = await (await fetch(`https://api.github.com/repos/${app.repo}`, fetchOptions)).json();
					ref = repoInfo && repoInfo.default_branch ? repoInfo.default_branch : 'main';
				}
			} else {
				// If latest release endpoint failed (rate limit or no releases), try repo info
				const repoResp = await fetch(`https://api.github.com/repos/${app.repo}`, fetchOptions);
				if (repoResp.ok) {
					const repoJson = await repoResp.json();
					ref = repoJson && repoJson.default_branch ? repoJson.default_branch : 'main';
				} else {
					ref = 'main';
				}
			}
		} catch (err) {
			// On any error, default to main
			ref = 'main';
		}
	}

	// Normalize installer path (no leading slash)
	let installerPath = app.installer || '';
	installerPath = installerPath.replace(/^\/+/, '');
	if (!installerPath) return null;

	// Construct raw.githubusercontent URL
	// Example: https://raw.githubusercontent.com/owner/repo/ref/path/to/file
	const encodedRef = encodeURIComponent(String(ref));
	// Ensure path segments are encoded and use forward slashes
	const normalizedPath = installerPath.split('/').map(part => encodeURIComponent(part)).join('/');
	const parts = [ 'https://raw.githubusercontent.com', app.repo, encodedRef, normalizedPath ];
	return parts.join('/');
}