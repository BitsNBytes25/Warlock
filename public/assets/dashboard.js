const servicesContainer = document.getElementById('servicesContainer');

/**
 *
 * @param servicesWithStats {app: AppData, host: HostAppData, service: ServiceData}
 */
function populateServicesTable(servicesWithStats) {
	const table = document.getElementById('services-table'),
		now = parseInt(Date.now() / 1000),
		threshold = now - 45, // 45 seconds ago
		app_guid = servicesWithStats.app.guid,
		host = servicesWithStats.host;

	Object.values(servicesWithStats.services).forEach(service => {
		let row = table.querySelector('tr.service[data-host="' + host.host + '"][data-service="' + service.service + '"]'),
			fields = ['host', 'icon', 'name', 'enabled', 'status', 'port', 'players', 'memory', 'cpu', 'age', 'actions'],
			statusIcon = '',
			actionButtons = [],
			enabledField = '',
			appIcon = renderAppIcon(app_guid);

		if (service.pre_exec || service.start_exec) {
			// Service has run in the past, so it should have log files available!
			actionButtons.push(`
<button title="View Logs" data-href="/service/logs/${app_guid}/${host.host}/${service.service}" class="link-control action-logs">
	<i class="fas fa-align-justify"></i> Logs
</button>`);
		}

		actionButtons.push(`
<button title="Configure Game" data-href="/service/configure/${app_guid}/${host.host}/${service.service}" class="link-control action-configure">
	<i class="fas fa-cog"></i> Config
</button>`);

		if (service.status === 'running') {
			statusIcon = '<i class="fas fa-check-circle"></i>';
			actionButtons.push(`
<button title="Stop Game" data-host="${host.host}" data-service="${service.service}" data-action="stop" data-guid="${app_guid}" class="service-control action-stop">
	<i class="fas fa-stop"></i> Stop
</button>`);
		}
		else if (service.status === 'stopped') {
			statusIcon = '<i class="fas fa-times-circle"></i>';
			actionButtons.push(`
<button title="Start Game" data-host="${host.host}" data-service="${service.service}" data-action="start" data-guid="${app_guid}" class="service-control action-start">
	<i class="fas fa-play"></i> Start
</button>`);
		}
		else if (service.status === 'starting') {
			statusIcon = '<i class="fas fa-sync-alt fa-spin"></i>';
			actionButtons.push(`
<button title="Stop Game" data-host="${host.host}" data-service="${service.service}" data-action="stop" data-guid="${app_guid}" class="service-control action-stop">
	<i class="fas fa-stop"></i> Stop
</button>`);
		}
		else if (service.status === 'stopping') {
			statusIcon = '<i class="fas fa-sync-alt fa-spin"></i>';
		}
		else {
			statusIcon = '<i class="fas fa-question-circle"></i>';
		}

		if (service.enabled) {
			enabledField = `
<button title="Enabled at Boot, click to disable" data-host="${host.host}" data-service="${service.service}" data-action="disable" data-guid="${app_guid}" class="service-control action-start">
				<i class="fas fa-check-circle"></i>
			</button>`;
		} else {
			enabledField = `
<button title="Disabled at Boot, click to enable" data-host="${host.host}" data-service="${service.service}" data-action="enable" data-guid="${app_guid}" class="service-control action-stop">
				<i class="fas fa-times-circle"></i>
			</button>`;
		}

		if (!row) {
			// Create new row
			row = document.createElement('tr');
			row.className = 'service';
			row.setAttribute('data-host', host.host);
			row.setAttribute('data-service', service.service);
			table.querySelector('tbody').appendChild(row);

			// Initialize empty cells
			fields.forEach(field => {
				const cell = document.createElement('td');
				cell.className = field;

				if (field === 'age') {
					cell.title = 'Data Last Updated';
				}
				else if (field === 'cpu') {
					cell.title = 'Percentage of a single thread process (100% being 1 full thread usage)';
				}

				row.appendChild(cell);
			});
		}

		row.dataset.updated = String(now); // Mark as found
		row.classList.remove('updating');

		fields.forEach(field => {
			const cell = row.querySelector('td.' + field);
			let val = service[field] || '';

			if (field === 'host') {
				val = renderHostName(host.host);
			}
			else if (field === 'age') {
				val = 'NOW';
				cell.classList.add('status-fresh');
				cell.classList.remove('status-idle');
				cell.classList.remove('status-disconnected');
			}
			else if (field === 'status') {
				// Check if this service has an exec/pre-exec error
				let error = false;
				if (service.pre_exec && service.pre_exec.status !== null && service.pre_exec.status !== 0) {
					error = true;
				}

				if (service.start_exec && service.start_exec.status !== null) {
					if (service.start_exec.status !== 0 && service.start_exec.status !== 15) {
						error = true;
					}
				}

				if (error) {
					val = statusIcon + ' ' + 'ERROR';
					cell.className = field + ' status-error';
				}
				else {
					val = statusIcon + ' ' + service[field].toUpperCase();
					cell.className = field + ' status-' + service[field];
				}
			}
			else if (field === 'enabled') {
				val = enabledField;
			}
			else if (field === 'players') {
				val = service.player_count || 0;
				if (service.max_players) {
					val += ' / ' + service.max_players;
				}
			} else if (field === 'memory') {
				val = service.memory_usage || '-';
			} else if (field === 'cpu') {
				val = service.cpu_usage || '-';
			}
			else if (field === 'actions') {
				val = actionButtons.join(' ');
			}
			else if (field === 'icon') {
				val = appIcon;
			}

			cell.innerHTML = val;
		});
	});

	// Services have been loaded, (at least one), remove "no services" and "services loading" messages
	if (table.querySelector('tr.no-services-available')) {
		table.querySelector('tr.no-services-available').remove();
	}
	table.querySelectorAll('tr.service-loading').forEach(row => {
		row.remove();
	});
}

function noServicesAvailable() {
	const table = document.getElementById('services-table'),
		row = document.createElement('tr'),
		colSpan = table.querySelectorAll('th').length,
		cell = document.createElement('td');

	table.querySelector('tbody').innerHTML = ''; // Clear existing rows

	row.className = 'service no-services-available';
	table.querySelector('tbody').appendChild(row);

	cell.colSpan = colSpan;
	cell.innerHTML = '<p class="warning-message">No services available. Please install applications to manage their services here.</p>';
	row.appendChild(cell);
}

async function loadAllServicesAndStats() {
	stream('/api/services/stream', 'GET',{},null,(event, data) => {
		if (event === 'message') {
			try {
				let parsed = JSON.parse(data);
				populateServicesTable(parsed);
			}
			catch (error) {
				console.error('Error parsing service stream data:', error, data);
			}
		}
		else if (event === 'NOSERVICES') {
			noServicesAvailable();
		}
		else {
			console.warn('Service stream error:', data);
		}
	}, true).catch(e => {
		console.error(e);
	});
}

/**
 *
 * @param {Object.<string, AppData>} applications
 */
function displayApplications(applications) {
	const applicationsList = document.getElementById('applicationsList');
	let installedApplications = 0;

	let html = '';
	for (const [guid, app] of Object.entries(applications)) {
		console.debug(app);
		// Skip applications which are not installed on any hosts
		if (!app.hosts || app.hosts.length === 0) {
			continue;
		}

		// Extract the last folder name from the path
		let //pathParts = app.path.split('/').filter(part => part.length > 0),
			displayName = app.title || guid,
			icon = renderAppIcon(guid),
			thumbnail = getAppThumbnail(guid);

		installedApplications += 1;

		html += `<div class="application-card" data-guid="${guid}">`;

		if (thumbnail) {
			html += `<img class="app-thumbnail" title="${displayName}" src="${thumbnail}" alt="${displayName} Thumbnail">`;
		}
		else {
			html += `
				<div class="app-title">
					<div class="app-icon">
						${icon}
					</div>
					<div class="app-name">
						<h4>${displayName}</h4>
					</div>
				</div>`;
		}

		html += `<div class="app-installs">`;

		app.hosts.forEach(host => {
			html += `<div class="app-install" data-host="${host.host}">
					<span class="host-name">${renderHostIcon(host.host)} ${renderHostName(host.host)}</span>
					<span class="host-actions">
						<button class="link-control action-backup" data-href="/application/backups/${guid}/${host.host}" title="Game Backups">
							<i class="fas fa-floppy-disk"></i>
						</button>
						<button class="link-control action-configure" data-href="/application/configure/${guid}/${host.host}" title="Configure Game">
							<i class="fas fa-cog"></i>
						</button>
						<button class="link-control action-browse" data-href="/files/${host.host}?path=${host.path}" title="Browse Files">
							<i class="fas fa-folder"></i>
						</button>
						<button class="link-control action-remove" data-href="/application/uninstall/${guid}/${host.host}" title="Uninstall Game">
							<i class="fas fa-trash-alt"></i>
						</button>
					</span>
				</div>`;
		});

		html += `</div></div>`;
	}

	if (installedApplications === 0) {
		applicationsList.innerHTML = `
			<div style="grid-column: 1 / -1;">
				<div class="error-message">
					<p style="text-align:center; width:100%;">
						<i class="fas fa-gamepad" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
						<br/>
						No applications installed yet!  Please visit the <a href="/application/install">Applications Library</a> to install your first application.
					</p>
				</div>
			</div>
		`;
		return;
	}

	applicationsList.innerHTML = html;
}

function displayNoHosts() {
	const applicationsList = document.getElementById('applicationsList');
	applicationsList.innerHTML = `
		<div style="grid-column: 1 / -1;">
			<div class="error-message">
				<p style="text-align:center; width:100%;">
					<i class="fas fa-server" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
					<br/>
					No hosts available. Please <a href="/host/add">add a host</a> to manage applications and services.
				</p>
			</div>
		</div>
	`;

	document.getElementById('servicesContainer').innerHTML = '';
}

function checkForUpdates() {
	document.querySelectorAll('.app-install .update-available').forEach(btn => {
		btn.classList.remove('update-available');
		btn.title = 'Configure Game';
		btn.querySelector('i').className = 'fas fa-cog';
	});

	fetch('/api/applications/updates').then(response => response.json()).then(data => {
		if (data.success) {
			const updates = data.updates || [];
			updates.forEach(update => {
				const appCard = document.querySelector(`.application-card[data-guid="${update.guid}"]`),
					hostInstall = appCard ? appCard.querySelector(`.app-install[data-host="${update.host}"]`) : null;

				if (hostInstall) {
					// Update the settings button to indicate an update is available
					const configButton = hostInstall.querySelector('.action-configure');
					if (configButton && !configButton.classList.contains('update-available')) {
						configButton.classList.add('update-available');
						configButton.title = 'Configure Game (Update Available)';
						configButton.querySelector('i').className = 'fas fa-circle-up';
					}
				}
			});
		}
	});
}


// Load on page load
window.addEventListener('DOMContentLoaded', () => {
	fetchHosts().then(hosts => {
		if (Object.values(hosts).length === 0) {
			displayNoHosts();
			return;
		}
		fetchApplications().then(applications => {
			// Display applications
			displayApplications(applications);

			loadAllServicesAndStats();

			// Refresh timer every second
			setInterval(() => {
				const table = document.getElementById('services-table'),
					rows = table.querySelectorAll('tr.service'),
					now = parseInt(Date.now() / 1000);

				rows.forEach(row => {
					const updated = parseInt(row.dataset.updated),
						age = now - updated,
						ageCell = row.querySelector('td.age');

					if (updated > 0 && ageCell) {
						ageCell.innerText = age < 2 ? 'NOW' : age + 's';

						if (age > 60) {
							// Remove this row entirely after 60 seconds of no updates
							row.remove();
						}
						else if (age >= 40) {
							ageCell.classList.remove('status-fresh');
							ageCell.classList.remove('status-idle');
							ageCell.classList.add('status-disconnected');
						}
						else if (age >= 30) {
							ageCell.classList.remove('status-fresh');
							ageCell.classList.add('status-idle');
							ageCell.classList.remove('status-disconnected');
						}
						else if (age <= 5) {
							ageCell.classList.add('status-fresh');
							ageCell.classList.remove('status-idle');
							ageCell.classList.remove('status-disconnected');
						}
						else {
							ageCell.classList.remove('status-fresh');
							ageCell.classList.remove('status-idle');
							ageCell.classList.remove('status-disconnected');
						}
					}
				});

				// Are there no records?
				if (table.querySelectorAll('tr.service').length === 0) {
					noServicesAvailable();
				}
			}, 1000);

			setTimeout(checkForUpdates, 10*1000); // Check for updates after 10 seconds
			setInterval(checkForUpdates, 60*15*1000); // Check for updates every 15 minutes
		}).catch(error => {
			document.getElementById('applicationsList').innerHTML = `<div style="grid-column:1/-1;"><p class="error-message">${error}</p></div>`;
			console.error('Error fetching applications:', error);
		});
	}).catch(error => {
		document.getElementById('applicationsList').innerHTML = `<div style="grid-column:1/-1;"><p class="error-message">${error}</p></div>`;
		console.error('Error fetching hosts:', error);
	});
});

// Dynamic events for various buttons
document.addEventListener('click', e => {
	if (e.target) {

		if (e.target.classList.contains('service-control') || e.target.closest('.service-control')) {
			let btn = e.target.classList.contains('service-control') ? e.target : e.target.closest('.service-control'),
				service = btn.dataset.service,
				action = btn.dataset.action,
				host = btn.dataset.host,
				guid = btn.dataset.guid;

			e.preventDefault();

			if (btn.classList.contains('disabled')) {
				return;
			}

			btn.classList.add('disabled');
			if (btn.closest('tr')) {
				btn.closest('tr').classList.add('updating');
			}

			serviceAction(guid, host, service, action);
		}
		else if (e.target.classList.contains('link-control') || e.target.closest('.link-control')) {
			let btn = e.target.classList.contains('link-control') ? e.target : e.target.closest('.link-control'),
				href = btn.dataset.href;

			e.preventDefault();

			window.location.href = href;
		}
	}

});