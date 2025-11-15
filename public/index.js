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
			fields = ['host', 'icon', 'name', 'status', 'port', 'players', 'memory', 'cpu', 'actions'],
			statusIcon = '',
			actionButtons = [],
			appIcon = renderAppIcon(app_guid);

		if (service.status === 'running') {
			statusIcon = '<i class="fas fa-check-circle"></i>';
			actionButtons.push(`
<button data-host="${host.host}" data-service="${service.service}" data-action="stop" data-guid="${app_guid}" class="service-control action-stop">
	<i class="fas fa-stop"></i> Stop
</button>`);
		} else if (service.status === 'stopped') {
			statusIcon = '<i class="fas fa-times-circle"></i>';
			actionButtons.push(`
<button data-href="/service/configure/${app_guid}/${host.host}/${service.service}" class="link-control action-configure">
	<i class="fas fa-cog"></i> Config
</button>`);
			actionButtons.push(`
<button data-host="${host.host}" data-service="${service.service}" data-action="start" data-guid="${app_guid}" class="service-control action-start">
	<i class="fas fa-play"></i> Start
</button>`);
		} else if (service.status === 'starting' || service.status === 'stopping') {
			statusIcon = '<i class="fas fa-sync-alt fa-spin"></i>';
		} else {
			statusIcon = '<i class="fas fa-question-circle"></i>';
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
				val = statusIcon + ' ' + service[field].toUpperCase();
				cell.className = field + ' status-' + service[field];
			} else if (field === 'players') {
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

function serviceAction(guid, host, service, action) {
	fetch(`/api/service/${action}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			guid: guid,
			host: host,
			service: service
		})
	})
		.then(response => {
			console.debug(response);
		})
		.catch(error => {
			console.error('Network error:', error);
		});
}

/**
 *
 * @param {Object.<string, AppData>} applications
 */
function displayApplications(applications) {
	const applicationsList = document.getElementById('applicationsList');

	if (Object.keys(applications).length === 0) {
		applicationsList.innerHTML = `
			<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #666;">
				<i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
				<p>No applications found in /var/lib/warlock</p>
			</div>
		`;
		return;
	}

	let html = '';
	for (const [guid, app] of Object.entries(applications)) {
		console.debug(app);
		// Extract the last folder name from the path
		let //pathParts = app.path.split('/').filter(part => part.length > 0),
			displayName = app.title || guid,
			icon = renderAppIcon(guid),
			thumbnail = app.thumbnail || null;

		if (thumbnail) {
			thumbnail = '<img class="app-thumbnail" src="' + thumbnail + '" alt="' + displayName + ' Thumbnail">';
		}


		html += `
			<div class="application-card">
				${thumbnail ? thumbnail : ''}
				<div class="app-name">
					<div class="app-icon">
						${icon}
					</div>
					<div style="flex: 1;">
						<h4>${displayName}</h4>
					</div>
				</div>
				<div class="app-installs">`;

		app.hosts.forEach(host => {
			html += `<div class="app-install">
					<span class="host-name">${renderHostIcon(host.host)} ${renderHostName(host.host)}</span>
					<span class="host-actions">
						<button class="link-control action-configure" data-href="/application/${guid}/configure/${host.host}" title="Configure Application">
							<i class="fas fa-cog"></i>
						</button>
						<button class="link-control action-browse" data-href="/files/${host.host}?path=${host.path}" title="Browse Files">
							<i class="fas fa-folder"></i>
						</button>
						<button class="ZZZZ action-remove" data-href="/application/${guid}/manage/${host.host}" title="Uninstall Game">
							<i class="fas fa-trash-alt"></i>
						</button>
					</span>
				</div>`;
		});

		html += `</div></div>`;
	}

	applicationsList.innerHTML = html;
}


// Load navigation component
fetch('/components/nav')
	.then(response => response.text())
	.then(html => {
		document.getElementById('nav-placeholder').innerHTML = html;
	})
	.catch(error => console.error('Error loading navigation:', error));

// Load on page load
window.addEventListener('DOMContentLoaded', () => {
	fetchHosts().then(hosts => {
		fetchApplications().then(applications => {
			// Display applications
			displayApplications(applications);

			loadAllServicesAndStats();
		}).catch(error => {
			console.error('Error fetching applications:', error);
		});
	}).catch(error => {
		console.error('Error fetching hosts:', error);
	});

	// Auto-refresh every 5 seconds
	setInterval(() => {
		loadAllServicesAndStats();
	}, 10000);
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