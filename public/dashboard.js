const servicesContainer = document.getElementById('servicesContainer');

function createServicesTable() {

	if (document.getElementById('services-table')) {
		return; // Table already exists
	}

	let tableHTML = `
		<div style="overflow-x: auto;">
			<table id="services-table">
				<thead>
					<tr class="header">
						<th>Host</th>
						<th>Game</th>
						<th>Server Name</th>
						<th>On-Boot</th>
						<th>Status</th>
						<th>Port</th>
						<th>Players</th>
						<th>Memory</th>
						<th>CPU</th>
						<th>
							Actions
							<i id="services-loading-indicator" style="opacity:0" class="fas fa-sync-alt fa-spin"></i>
						</th>
					</tr>
				</thead>
				<tbody></tbody>
			</table>
		</div>
	`;

	servicesContainer.innerHTML = tableHTML;
}

/**
 *
 * @param servicesWithStats {[{app: AppData, host: HostAppData, service: ServiceData}]}
 */
function populateServicesTable(servicesWithStats) {
	console.log('Populating table with services:', servicesWithStats);

	if (servicesWithStats.length === 0) {
		servicesContainer.innerHTML = '<p style="color: #87ceeb; text-align: center; padding: 2rem;">No services found.</p>';
		return;
	}
	else {
		createServicesTable();
	}

	const table = document.getElementById('services-table');

	table.querySelectorAll('tr.service').forEach(row => {
		row.dataset.found = '0'; // Mark all existing rows as not found
	});

	servicesWithStats.forEach(record => {
		let service = record.service,
			app_guid = record.app,
			host = record.host,
			row = table.querySelector('tr.service[data-host="' + host.host + '"][data-service="' + service.service + '"]'),
			fields = ['host', 'icon', 'name', 'enabled', 'status', 'port', 'players', 'memory', 'cpu', 'actions'],
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
<button title="Configure Game" data-href="/service/configure/${app_guid}/${host.host}/${service.service}" class="link-control action-configure">
	<i class="fas fa-cog"></i> Config
</button>`);
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
				row.appendChild(cell);
			});
		}

		row.dataset.found = '1'; // Mark as found
		row.classList.remove('updating');

		fields.forEach(field => {
			const cell = row.querySelector('td.' + field);
			let val = service[field] || '';

			if (field === 'host') {
				val = renderHostName(host.host);
			}
			else if (field === 'status') {
				// Check if this service has an exec/pre-exec error
				let error = false;
				if (service.pre_exec && service.pre_exec.status !== null && service.pre_exec.status !== 0) {
					error = true;
				}
				if (service.start_exec && service.start_exec.status !== null && service.start_exec.status !== 0) {
					error = true;
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

	table.querySelectorAll('tr.service').forEach(row => {
		if (row.dataset.found === '0') {
			// Remove rows not found in the latest data
			row.remove();
			console.debug('Removed stale row for service:', row.dataset.service);
		}
	});
}

async function loadAllServicesAndStats() {
	if (document.getElementById('services-loading-indicator')) {
		document.getElementById('services-loading-indicator').style.opacity = '1';
	}

	fetchServices().then(services => {
		console.debug('Fetched services:', services);
		populateServicesTable(services);

		if (document.getElementById('services-loading-indicator')) {
			document.getElementById('services-loading-indicator').style.opacity = '0';
		}
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
			thumbnail = app.thumbnail || null;

		installedApplications += 1;

		html += `<div class="application-card">`;

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
			html += `<div class="app-install">
					<span class="host-name">${renderHostIcon(host.host)} ${renderHostName(host.host)}</span>
					<span class="host-actions">
						<button class="link-control action-create" data-href="/application/install/${guid}/${host.host}" title="Reinstall/Repair Application">
							<i class="fas fa-undo"></i>
						</button>
						<button class="link-control action-configure" data-href="/application/configure/${guid}/${host.host}" title="Configure Application">
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

			// Auto-refresh every 5 seconds
			setInterval(() => {
				loadAllServicesAndStats();
			}, 10000);
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