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

	if (app.source === 'github') {
		const resp = await fetch(`https://api.github.com/repos/${app.repo}/branches`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		}),
			// Branches which should get set as default, IN ORDER of the preference.
			defaultBranches = ['stable', 'main', 'master'];

		if (resp.ok) {
			const json = await resp.json();
			let branches = [];

			json.forEach(branch => {
				branches.push(branch.name);
			});

			// Find default branch
			for (let defBranch of defaultBranches) {
				if (branches.includes(defBranch)) {
					return `https://raw.githubusercontent.com/${app.repo}/refs/heads/${defBranch}/${app.installer}`;
				}
			}

			// If no default branch found, use the first branch in the list
			if (branches.length > 0) {
				return `https://raw.githubusercontent.com/${app.repo}/refs/heads/${branches[0]}/${app.installer}`;
			}
			else {
				return null;
			}
		}
		else {
			return null;
		}
	}
}
