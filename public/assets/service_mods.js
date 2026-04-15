let serviceModsEmailHash = null,
	serviceModsAuthenticated = false;

async function loadServiceMods() {
	const host = loadedHost || null,
		guid = loadedApplication || null,
		service = loadedService || null,
		hostToken = loadedHostData?.token || null,
		hostEmail = loadedHostData?.email || null,
		serviceModsNotAvailable = document.getElementById('serviceModsNotAvailable'),
		serviceModsNotSupported = document.getElementById('serviceModsNotSupported'),
		serviceModsLoading = document.getElementById('serviceModsLoading'),
		serviceModsNotAuthenticated = document.getElementById('serviceModsNotAuthenticated'),
		serviceModsCurrentMods = document.getElementById('serviceModsCurrentMods'),
		serviceModsSearch = document.getElementById('serviceModsSearch'),
		serviceModsSearchInput = document.getElementById('serviceModsSearchInput'),
		serviceModsSearchResults = document.getElementById('serviceModsSearchResults');

	// Reset application state
	serviceModsNotAvailable.style.display = 'block';
	serviceModsNotSupported.style.display = 'none';
	serviceModsNotAuthenticated.style.display = 'none';
	serviceModsLoading.style.display = 'none';
	serviceModsSearch.style.display = 'none';
	serviceModsCurrentMods.innerHTML = '';
	serviceModsSearchInput.value = '';
	serviceModsSearchResults.innerHTML = '';

	if (!host || !service || !guid) {
		console.error('Host, service, or app GUID not specified for loading metrics');
		return;
	}

	// Ensure this game currently supports mods via the API.
	if (!checkHostAppHasOption(guid, host, 'get-mods')) {
		serviceModsNotAvailable.style.display = 'none';
		serviceModsNotSupported.style.display = 'block';
		return;
	}

	serviceModsNotAvailable.style.display = 'none';
	serviceModsLoading.style.display = 'block';

	// If the host has Warlock.Nexus parameters set, ping to check if the host is currently authenticated.
	if (hostToken && hostEmail) {
		serviceModsEmailHash = await sha256(hostEmail);

		const headers = {
			'X-Host-Token': hostToken,
			'X-Email': serviceModsEmailHash
		}
		const result = await fetch('https://api.warlock.nexus/host/ping', {headers}).then(r => r.json());
		if (!result.success) {
			serviceModsNotAuthenticated.style.display = 'block';
		}
		else {
			serviceModsAuthenticated = true;
			serviceModsSearch.style.display = 'block';
		}
	}

	loadServiceEnabledMods();

}

async function loadServiceEnabledMods() {
	const host = loadedHost || null,
		guid = loadedApplication || null,
		service = loadedService || null,
		serviceModsNotAvailable = document.getElementById('serviceModsNotAvailable'),
		serviceModsLoading = document.getElementById('serviceModsLoading'),
		serviceModsCurrentMods = document.getElementById('serviceModsCurrentMods');

	serviceModsLoading.style.display = 'block';
	// Fetch current mods from the game
	const enabledModsResult = await fetch(`/api/service/mods/${guid}/${host}/${service}`).then(r => r.json());
	if (!enabledModsResult?.success) {
		console.error('Failed to fetch enabled mods:', enabledModsResult);
		serviceModsLoading.style.display = 'none';
		serviceModsNotAvailable.style.display = 'block';
		return;
	}
	try {
		const mods = JSON.parse(enabledModsResult.output);

		let modActions = [];

		if (serviceModsAuthenticated) {
			modActions.push('remove');
		}

		serviceModsNotAvailable.style.display = 'none';
		serviceModsLoading.style.display = 'none';

		if (mods.length === 0) {
			serviceModsCurrentMods.innerHTML = '<h3>Enabled Mods</h3><p class="info-message">No mods are currently enabled for this service.</p>';
		}
		else {
			serviceModsCurrentMods.innerHTML = '<h3>Enabled Mods</h3>';
			const container = document.createElement('div');
			container.className = 'card-view';
			serviceModsCurrentMods.appendChild(container);
			mods.forEach(mod => {
				container.appendChild(renderServiceMod(mod, modActions));
			});
		}
	}
	catch (e) {
		console.error('Failed to parse mods JSON:', e);
		serviceModsLoading.style.display = 'none';
		serviceModsNotAvailable.style.display = 'block';
		return;
	}
}

/**
 * Search for mods with the Warlock.Nexus API
 *
 * @param query {string} Search query
 * @returns {Promise<void>}
 */
async function searchServiceMods(query) {
	if (!serviceModsEmailHash ) {
		console.error('Service mods not authenticated');
		return;
	}
	if (!serviceModsAuthenticated ) {
		console.error('Service mods not authenticated');
		return;
	}

	const host = loadedHost || null,
		guid = loadedApplication || null,
		service = loadedService || null,
		hostToken = loadedHostData?.token || null,
		version = loadedServiceData?.version || null,
		loader = loadedServiceData?.loader || null,
		serviceModsLoading = document.getElementById('serviceModsLoading'),
		serviceModsSearchResults = document.getElementById('serviceModsSearchResults');

	if (!query) {
		// Just clear the search window.
		serviceModsSearchResults.innerHTML = '';
		return;
	}

	serviceModsSearchResults.innerHTML = '<div><i class="fa fa-spinner fa-spin"></i> Searching for mods...</div>';

	const headers = {
		'X-Host-Token': hostToken,
	}
	const url = new URL(`https://api.warlock.nexus/mod/search/${guid}`);
	url.searchParams.append('query', query);
	if (version) {
		url.searchParams.append('version', version);
	}
	if (loader) {
		url.searchParams.append('loader', loader);
	}
	const result = await fetch(url.toString(), {headers}).then(r => r.json());
	if (!result.success) {
		serviceModsSearchResults.innerHTML = '<div class="error-message">Failed to search mods: ' + result.message + '</div>';
	}
	else {
		serviceModsSearchResults.innerHTML = '';
		result.data.forEach(mod => {
			serviceModsSearchResults.appendChild(renderServiceMod(mod, ['install']));
		})
	}
}

async function installServiceMod(modId, provider) {
	const host = loadedHost || null,
		guid = loadedApplication || null,
		service = loadedService || null,
		hostToken = loadedHostData?.token || null,
		serviceModsLoading = document.getElementById('serviceModsLoading');

	showToast('info', 'Installing mod, please wait a moment...');
	serviceModsLoading.style.display = 'block';

	const installModResult = await fetch(
		`/api/service/mods/${guid}/${host}/${service}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({id: modId, provider}),
		}
	).then(r => r.json());
	serviceModsLoading.style.display = 'none';
	if (installModResult.success) {
		loadServiceEnabledMods();
	}
	else {
		showToast('error', `Failed to install mod: ${installModResult.error}`);
	}
}

async function removeServiceMod(modId, provider) {
	const host = loadedHost || null,
		guid = loadedApplication || null,
		service = loadedService || null,
		hostToken = loadedHostData?.token || null,
		serviceModsLoading = document.getElementById('serviceModsLoading');

	showToast('info', 'Removing mod, please wait a moment...');
	serviceModsLoading.style.display = 'block';

	const installModResult = await fetch(
		`/api/service/mods/${guid}/${host}/${service}`,
		{
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({id: modId, provider}),
		}
	).then(r => r.json());
	serviceModsLoading.style.display = 'none';
	if (installModResult.success) {
		loadServiceEnabledMods();
	}
	else {
		showToast('error', `Failed to remove mod: ${installModResult.error}`);
	}
}

/**
 * Render a single mod entry
 *
 * @param modData
 * @param modData.name {string} Name of the mod
 * @param modData.version {string} Version string of this mod
 * @param modData.description {string} Short description of the mod
 * @param modData.author {string} Author name
 * @param modData.url {string|null} URL to the mod homepage or info page
 * @param modData.icon {string|null} Full URL to the icon image for this mod
 * @param modData.id {string|int} Provider-specific ID for this mod
 * @param modData.provider {string|null} Provider name of where this mod came from
 * @param modData.source {string} Full URL to install this mod, (not generally used here)
 * @param modData.package {string} Package name of this mod, (not generally used here)
 *
 * @param allowableActions {string[]}
 *
 * @returns {HTMLElement}
 */
function renderServiceMod(modData, allowableActions = []) {
	const container = document.createElement('div');
	container.className = 'mod-entry card';
	container.dataset.id = modData.id;

	// Create Icon Element
	const icon = document.createElement('img');
	icon.className = 'mod-icon';
	icon.src = modData.icon || '/assets/media/kde-oxygen/categories/applications-science.png'; // Fallback to a default icon
	icon.alt = `${modData.name} icon`;

	// Create Content Container (Text Info)
	const content = document.createElement('div');
	content.className = 'mod-details';

	const title = document.createElement('span');
	title.className = 'mod-name';
	title.textContent = modData.name;

	const metaInfo = document.createElement('div');
	metaInfo.className = 'mod-meta';
	// Showing version and provider if available
	const providerText = modData.provider ? ` [${modData.provider}]` : '';
	metaInfo.textContent = `${modData.version}${providerText}`;

	const description = document.createElement('p');
	description.className = 'mod-description';
	description.textContent = modData.description || '';

	const author = document.createElement('small');
	author.className = 'mod-author';
	author.textContent = `By ${modData.author}`;

	const header = document.createElement('h4');
	header.className = 'mod-header';
	header.appendChild(icon);
	header.appendChild(title);

	//content.appendChild(title);
	//content.appendChild(metaInfo);
	//content.appendChild(description);
	//content.appendChild(author);

	// Create Actions Container (Buttons)
	const actionsContainer = document.createElement('div');
	actionsContainer.className = 'actions';

	if (modData.url) {
		const link = document.createElement('a');
		link.className = 'button';
		link.href = modData.url;
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.textContent = 'View Mod';
		actionsContainer.appendChild(link);
	}

	allowableActions.forEach(action => {
		const button = document.createElement('button');
		button.className = `action-${action}`;
		// Capitalize the first letter for the button label (e.g., 'install' -> 'Install')
		button.textContent = action.charAt(0).toUpperCase() + action.slice(1);
		button.dataset.action = action;
		button.dataset.id = modData.id;
		button.dataset.provider = modData.provider;

		if (action === 'install') {
			button.addEventListener('click', e => {
				e.preventDefault();
				installServiceMod(modData.id, modData.provider);
			});
		}
		else if (action === 'remove') {
			button.addEventListener('click', e => {
				e.preventDefault();
				if (confirm('Confirm removal of this mod?')) {
					removeServiceMod(modData.id, modData.provider);
				}
			});
		}
		actionsContainer.appendChild(button);
	});

	// Assemble everything
	container.appendChild(header);
	container.appendChild(metaInfo);
	container.appendChild(description);
	container.appendChild(author);
	container.appendChild(actionsContainer);

	return container;
}

document.getElementById('serviceModsSearchInput').addEventListener('keyup', e => {
	if (e.key === 'Enter') {
		searchServiceMods(e.target.value);
	}
});
