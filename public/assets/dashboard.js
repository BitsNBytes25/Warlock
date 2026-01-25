const servicesContainer = document.getElementById('servicesContainer'),
	stopModal = document.getElementById('stopModal'),
	servicesTable = document.getElementById('services-table');

// Metrics Modal Functionality
let metricsCharts = {};

// List of services which are being watched live; these should have the lazy lookups ignored.
let liveServices = [];

/**
 *
 * @param servicesWithStats {app: {string}, host: HostAppData, service: ServiceData}
 */
function populateServicesTable(servicesWithStats) {
	const table = servicesTable,
		now = parseInt(Date.now() / 1000),
		threshold = now - 45, // 45 seconds ago
		app_guid = servicesWithStats.app,
		host = servicesWithStats.host,
		service = servicesWithStats.service;

	let row = table.querySelector('div.service[data-host="' + host.host + '"][data-service="' + service.service + '"]'),
		fields = ['thumbnail', 'host', 'icon', 'name', 'enabled', 'status', 'port', 'players', 'memory', 'cpu', 'actions'],
		statusIcon = '',
		actionButtons = [],
		enabledField = '',
		appIcon = renderAppIcon(app_guid),
		supportsDelayedStop = servicesWithStats.host.options.includes('delayed-stop') ? '1' : '0',
		supportsDelayedRestart = servicesWithStats.host.options.includes('delayed-restart') ? '1' : '0';

	actionButtons.push(`
<button title="Game Details" data-href="/service/details/${app_guid}/${host.host}/${service.service}" class="link-control action-view">
<i class="fas fa-cog"></i><span>Details</span>
</button>`);

	if (service.status === 'running') {
		statusIcon = '<i class="fas fa-check-circle"></i>';
		actionButtons.push(`
<button title="Stop Game" data-host="${host.host}" data-service="${service.service}" data-guid="${app_guid}" data-support-delayed-stop="${supportsDelayedStop}" data-support-delayed-restart="${supportsDelayedRestart}" class="open-stop-modal action-stop">
<i class="fas fa-stop"></i><span>Stop</span>
</button>`);
	}
	else if (service.status === 'stopped') {
		statusIcon = '<i class="fas fa-times-circle"></i>';
		actionButtons.push(`
<button title="Start Game" data-host="${host.host}" data-service="${service.service}" data-action="start" data-guid="${app_guid}" class="service-control action-start">
<i class="fas fa-play"></i><span>Start</span>
</button>`);
	}
	else if (service.status === 'starting') {
		statusIcon = '<i class="fas fa-sync-alt fa-spin"></i>';
		actionButtons.push(`
<button title="Stop Game" data-host="${host.host}" data-service="${service.service}" data-action="stop" data-guid="${app_guid}" class="service-control action-stop">
<i class="fas fa-stop"></i><span>Stop</span>
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
		row = document.createElement('div');
		row.className = 'service';
		row.setAttribute('data-host', host.host);
		row.setAttribute('data-service', service.service);
		table.querySelector('.body').appendChild(row);

		// Initialize empty cells
		fields.forEach(field => {
			const cell = document.createElement('div');
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
		const cell = row.querySelector('div.' + field);
		let val = service[field] || '';

		if (field === 'host') {
			val = renderHostName(host.host);
		}
		else if (field === 'thumbnail') {
			val = getAppThumbnail(app_guid);
			if (val) {
				val = `<img class="app-thumbnail" src="${val}" alt="App Thumbnail">`;
			}
			else {
				val = '';
			}
		}
		else if (field === 'response_time') {
			if (val > 1000) {
				val = (val / 1000).toFixed(2) + ' s';
			}
			else {
				val = val + ' ms';
			}
		}
		else if (field === 'status') {
			val = statusIcon + ' ' + service[field].toUpperCase();
			cell.className = field + ' status-' + service[field];
		}
		else if (field === 'enabled') {
			val = enabledField;
		}
		else if (field === 'players') {
			val = service.player_count || 0;
			if (service.max_players) {
				val += ' / ' + service.max_players;
			}
			// If service.players is an array with more than one element, show a tooltip with player names
			if (Array.isArray(service.players) && service.players.length > 0) {
				let playerNames = service.players.map(p => p.player_name).join(', ');
				cell.title = 'Current Players: ' + playerNames;
			}
		} else if (field === 'memory') {
			val = service.memory_usage || '-';
		} else if (field === 'cpu') {
			val = service.cpu_usage || '-';
		}
		else if (field === 'actions') {
			val = '<div class="">' + actionButtons.join(' ') + '</div>';

			// Also update mobile actions row if on mobile
			if (window.innerWidth <= 900) {
				const actionsRow = row.nextElementSibling;
				if (actionsRow && actionsRow.classList.contains('service-actions')) {
					const mobileActions = actionsRow.querySelector('.mobile-actions');
					if (mobileActions) {
						mobileActions.innerHTML = actionButtons.join(' ');
					}
				}
			}
		}
		else if (field === 'icon') {
			val = appIcon;
		}

		cell.innerHTML = val;
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

/**
 * Load all services and their stats
 */
function loadAllServicesAndStats() {
	fetch('/api/services', {method: 'GET'})
		.then(r => r.json())
		.then(results => {
			if (results.success && results.services.length > 0) {
				results.services.forEach(s => {
					if (liveServices.includes(s.app + '|' + s.host.host + '|' + s.service.service)) {
						return;
					}
					populateServicesTable(s);
				});
			}
			else {
				console.error('Error loading services.', results);
				noServicesAvailable();
			}
		});
}

/**
 * Stream service stats for a given application, host, and service
 *
 * Will ping the host much more frequently to provide more real-time updates to the user.
 *
 * Operation automatically stops once the target service state has been reached.
 *
 * @param {string} app_guid
 * @param {string} host
 * @param {string} service
 * @param {string} target_state
 */
function streamServiceStats(app_guid, host, service, target_state) {
	// What's the target state for this service to stop streaming?
	let targetKey, targetValue, targetStateMessage;

	if (target_state === 'start') {
		targetKey = 'status';
		targetValue = 'running';
		targetStateMessage = 'Service has started successfully.';
	}
	else if (target_state === 'stop') {
		targetKey = 'status';
		targetValue = 'stopped';
		targetStateMessage = 'Service has stopped successfully.';
	}
	else if (target_state === 'restart') {
		targetKey = 'status';
		targetValue = 'running';
		targetStateMessage = 'Service has restarted successfully.';
	}
	else if (target_state === 'enable') {
		targetKey = 'enabled';
		targetValue = true;
		targetStateMessage = 'Service has been enabled to start on-boot.';
	}
	else if (target_state === 'disable') {
		targetKey = 'enabled';
		targetValue = false;
		targetStateMessage = 'Service has been disabled from starting on-boot.';
	}
	else {
		console.error('Invalid target state for streaming service stats:', target_state);
	}

	// Skip this service from lazy updates
	liveServices.push(app_guid + '|' + host + '|' + service);

	let res = stream(`/api/service/stream/${app_guid}/${host}/${service}`, 'GET',{},null,(event, data) => {
		if (event === 'message') {
			try {
				let parsed = JSON.parse(data);
				populateServicesTable(parsed);

				// Has the target state been reached?
				if (parsed.service[targetKey] === targetValue) {
					// Remove from live services
					liveServices = liveServices.filter(s => s !== (app_guid + '|' + host + '|' + service));
					showToast('success', targetStateMessage);
					return false;
				}
			}
			catch (error) {
				console.error('Error parsing service stream data:', error, data);
			}
		}
		else {
			console.warn('Service stream error:', data);
		}
	}, true);
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

// Dynamic events for various buttons
document.addEventListener('click', e => {
	if (e.target) {
		if (e.target.classList.contains('service-control') || e.target.closest('.service-control')) {
			let btn = e.target.classList.contains('service-control') ? e.target : e.target.closest('.service-control'),
				service = btn.dataset.service,
				action = btn.dataset.action,
				host = btn.dataset.host,
				guid = btn.dataset.guid,
				tr = servicesContainer.querySelector(`tr[data-host="${host}"][data-service="${service}"]`);

			e.preventDefault();

			if (btn.classList.contains('disabled')) {
				return;
			}

			stopModal.classList.remove('show');

			if (action === 'delayed-stop' || action === 'delayed-restart') {
				// Delayed actions do not trigger live stats streaming
				serviceAction(guid, host, service, action).then(() => {
					showToast('success', `Sent ${action.replace('-', ' ')} command to ${service}, task may take up to an hour to complete.`);
				});
			}
			else {
				btn.classList.add('disabled');
				if (tr) {
					tr.classList.add('updating');
					// Swap the icon to a spinner to indicate a status change
					let icon = tr.querySelector('td.status i');
					if (icon) {
						icon.className = 'fas fa-sync-alt fa-spin';
					}
				}

				serviceAction(guid, host, service, action).then(() => {
					streamServiceStats(guid, host, service, action);
				});
			}
		}
		else if (e.target.classList.contains('link-control') || e.target.closest('.link-control')) {
			let btn = e.target.classList.contains('link-control') ? e.target : e.target.closest('.link-control'),
				href = btn.dataset.href;

			e.preventDefault();

			window.location.href = href;
		}
		else if (e.target.classList.contains('action-metrics') || e.target.closest('.action-metrics')) {
			let btn = e.target.classList.contains('action-metrics') ? e.target : e.target.closest('.action-metrics'),
				service = btn.dataset.service,
				host = btn.dataset.host,
				guid = btn.dataset.guid;

			e.preventDefault();
			openMetricsModal(host, service, guid);
		}
		else if (e.target.classList.contains('open-stop-modal') || e.target.closest('.open-stop-modal')) {
			let btn = e.target.classList.contains('open-stop-modal') ? e.target : e.target.closest('.open-stop-modal'),
				service = btn.dataset.service,
				host = btn.dataset.host,
				guid = btn.dataset.guid,
				supportsDelayedStop = btn.dataset.supportDelayedStop === '1',
				supportsDelayedRestart = btn.dataset.supportDelayedRestart === '1';

			stopModal.classList.add('show');
			stopModal.querySelectorAll('.service-control').forEach(el => {
				let action = el.dataset.action;

				if (action === 'delayed-stop') {
					if (supportsDelayedStop) {
						el.style.display = 'inline-block';
					} else {
						el.style.display = 'none';
					}
				}
				if (action === 'delayed-restart') {
					if (supportsDelayedRestart) {
						el.style.display = 'inline-block';
					} else {
						el.style.display = 'none';
					}
				}

				el.dataset.service = service;
				el.dataset.host = host;
				el.dataset.guid = guid;
				el.classList.remove('disabled');
			});

			// stopModal
		}
	}

});



// Load on page load
window.addEventListener('DOMContentLoaded', () => {
	// Set initial view from localStorage
	const savedView = localStorage.getItem('dashboard-services-view');
	if (savedView === 'card-view' || savedView === 'table-view') {
		servicesTable.classList.add(savedView);
	}
	else {
		servicesTable.classList.add('table-view'); // Default view
	}

	// Add resize handler to force UI to card view when less than 1200px wide.
	window.addEventListener('resize', () => {
		if (window.innerWidth < 1200 && servicesTable.classList.contains('table-view')) {
			servicesTable.classList.remove('table-view');
			servicesTable.classList.add('card-view');
			servicesTable.dataset.mobileOverride = '1';
		}
		else if (window.innerWidth >= 1200 && servicesTable.dataset.mobileOverride === '1') {
			servicesTable.classList.remove('card-view');
			servicesTable.classList.add('table-view');
			delete servicesTable.dataset.mobileOverride;
		}
	});
	if (window.innerWidth < 1200 && servicesTable.classList.contains('table-view')) {
		servicesTable.classList.remove('table-view');
		servicesTable.classList.add('card-view');
		servicesTable.dataset.mobileOverride = '1';
	}

	fetchHosts().then(hosts => {
		if (Object.values(hosts).length === 0) {
			displayNoHosts();
			return;
		}
		fetchApplications().then(applications => {
			// Load all services and periodically update the list
			loadAllServicesAndStats();
			setInterval(loadAllServicesAndStats, 60*1000); // Refresh services every 60 seconds

			document.querySelectorAll('.view-changer').forEach(btn => {
				btn.addEventListener('click', () => {
					servicesTable.classList.remove('card-view', 'table-view');
					servicesTable.classList.add(btn.dataset.view);
					localStorage.setItem('dashboard-services-view', btn.dataset.view);
				});
			});
		}).catch(error => {
			document.getElementById('applicationsList').innerHTML = `<div style="grid-column:1/-1;"><p class="error-message">${error}</p></div>`;
			console.error('Error fetching applications:', error);
		});
	}).catch(error => {
		document.getElementById('applicationsList').innerHTML = `<div style="grid-column:1/-1;"><p class="error-message">${error}</p></div>`;
		console.error('Error fetching hosts:', error);
	});
});


