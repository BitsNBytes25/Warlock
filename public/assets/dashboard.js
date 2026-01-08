const servicesContainer = document.getElementById('servicesContainer'),
	stopModal = document.getElementById('stopModal');

// Metrics Modal Functionality
let metricsCharts = {};
let currentMetricsData = {host: null, service: null, guid: null};
let metricsRefreshInterval = null;

// List of services which are being watched live; these should have the lazy lookups ignored.
let liveServices = [];

/**
 *
 * @param servicesWithStats {app: {string}, host: HostAppData, service: ServiceData}
 */
function populateServicesTable(servicesWithStats) {
	const table = document.getElementById('services-table'),
		now = parseInt(Date.now() / 1000),
		threshold = now - 45, // 45 seconds ago
		app_guid = servicesWithStats.app,
		host = servicesWithStats.host,
		service = servicesWithStats.service;

	let row = table.querySelector('tr.service[data-host="' + host.host + '"][data-service="' + service.service + '"]'),
		fields = ['host', 'icon', 'name', 'enabled', 'status', 'port', 'players', 'memory', 'cpu', 'actions'],
		statusIcon = '',
		actionButtons = [],
		enabledField = '',
		appIcon = renderAppIcon(app_guid),
		supportsDelayedStop = servicesWithStats.host.options.includes('delayed-stop') ? '1' : '0',
		supportsDelayedRestart = servicesWithStats.host.options.includes('delayed-restart') ? '1' : '0';

	actionButtons.push(`
<button title="View Logs" data-href="/service/logs/${app_guid}/${host.host}/${service.service}" class="link-control action-logs">
<i class="fas fa-align-justify"></i><span>Logs</span>
</button>`);

	actionButtons.push(`
<button title="Configure Game" data-href="/service/configure/${app_guid}/${host.host}/${service.service}" class="link-control action-configure">
<i class="fas fa-cog"></i><span>Config</span>
</button>`);

	actionButtons.push(`
<button title="View Metrics" data-host="${host.host}" data-service="${service.service}" data-guid="${app_guid}" class="action-metrics">
<i class="fas fa-chart-line"></i><span>Charts</span>
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

		// Add mobile actions row only on mobile screens
		if (window.innerWidth <= 900) {
			const actionsRow = document.createElement('tr');
			actionsRow.className = 'service-actions';
			actionsRow.setAttribute('data-host', host.host);
			actionsRow.setAttribute('data-service', service.service);
			const actionsCell = document.createElement('td');
			actionsCell.colSpan = fields.length;
			actionsCell.innerHTML = '<div class="mobile-actions"></div>';
			actionsRow.appendChild(actionsCell);
			row.after(actionsRow);
		}
	}

	row.dataset.updated = String(now); // Mark as found
	row.classList.remove('updating');

	fields.forEach(field => {
		const cell = row.querySelector('td.' + field);
		let val = service[field] || '';

		if (field === 'host') {
			val = renderHostName(host.host);
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
		} else if (field === 'memory') {
			val = service.memory_usage || '-';
		} else if (field === 'cpu') {
			val = service.cpu_usage || '-';
		}
		else if (field === 'actions') {
			val = '<div class="button-group">' + actionButtons.join(' ') + '</div>';

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

// Dynamic events for various buttons
document.addEventListener('click', e => {
	if (e.target) {

		// Mobile: Toggle service actions row
		if (window.innerWidth <= 900 && window.innerWidth > 445) {
			const serviceRow = e.target.closest('tr.service:not(.service-actions)');
			if (serviceRow && !e.target.closest('button')) {
				e.preventDefault();
				serviceRow.classList.toggle('expanded');
				return;
			}
		}

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



function openMetricsModal(host, service, guid) {
	currentMetricsData = {host, service, guid};
	document.getElementById('metricsModal').style.display = 'flex';
	loadMetrics('day');

	// Set up auto-refresh every 65 seconds
	if (metricsRefreshInterval) {
		clearInterval(metricsRefreshInterval);
	}
	metricsRefreshInterval = setInterval(() => {
		const activeTimeframe = document.querySelector('.timeframe-btn.active')?.dataset.timeframe || 'day';
		loadMetrics(activeTimeframe);
	}, 65000);
}

function closeMetricsModal() {
	document.getElementById('metricsModal').style.display = 'none';

	// Clear refresh interval
	if (metricsRefreshInterval) {
		clearInterval(metricsRefreshInterval);
		metricsRefreshInterval = null;
	}

	// Destroy existing charts
	Object.values(metricsCharts).forEach(chart => {
		if (chart) chart.destroy();
	});
	metricsCharts = {};
}

async function loadMetrics(timeframe) {
	const {host, service, guid} = currentMetricsData;

	try {
		const response = await fetch(`/api/metrics/${host}/${service}?timeframe=${timeframe}`);
		const result = await response.json();

		if (!result.success) {
			console.error('Error loading metrics:', result.error);
			return;
		}

		renderCharts(result.data, timeframe);
	} catch (error) {
		console.error('Error fetching metrics:', error);
	}
}

function renderCharts(metrics, timeframe) {
	// Group metrics by type
	const groupedMetrics = {
		cpu_usage: [],
		memory_usage: [],
		player_count: [],
		status: [],
		response_time: []
	};

	metrics.forEach(metric => {
		groupedMetrics['cpu_usage'].push({
			timestamp: metric.timestamp * 1000, // Convert to milliseconds
			value: metric.cpu_usage
		});
		groupedMetrics['memory_usage'].push({
			timestamp: metric.timestamp * 1000,
			value: metric.memory_usage
		});
		groupedMetrics['player_count'].push({
			timestamp: metric.timestamp * 1000,
			value: metric.player_count
		});
		groupedMetrics['status'].push({
			timestamp: metric.timestamp * 1000,
			value: metric.status
		});
		groupedMetrics['response_time'].push({
			timestamp: metric.timestamp * 1000,
			value: metric.response_time
		});
	});

	// Destroy existing charts
	Object.values(metricsCharts).forEach(chart => {
		if (chart) chart.destroy();
	});

	// Common chart options
	const commonOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: false
			},
			tooltip: {
				backgroundColor: 'rgba(0, 0, 0, 0.8)',
				titleColor: '#fff',
				bodyColor: '#fff',
				borderColor: '#0096ff',
				borderWidth: 1
			}
		},
		scales: {
			x: {
				type: 'time',
				time: {
					unit: getTimeUnit(timeframe)
				},
				grid: {
					color: 'rgba(255, 255, 255, 0.1)'
				},
				ticks: {
					color: '#fff',
					font: {
						size: 11
					}
				},
				title: {
					color: '#fff'
				}
			},
			y: {
				grid: {
					color: 'rgba(255, 255, 255, 0.1)'
				},
				ticks: {
					color: '#fff',
					font: {
						size: 11
					}
				},
				title: {
					color: '#fff'
				}
			}
		}
	};

	// CPU Chart
	metricsCharts.cpu = new Chart(document.getElementById('cpuChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'CPU %',
				data: groupedMetrics.cpu_usage.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#0096ff',
				backgroundColor: 'rgba(0, 150, 255, 0.1)',
				fill: true,
				tension: 0.4
			}]
		},
		options: commonOptions
	});

	// Memory Chart
	metricsCharts.memory = new Chart(document.getElementById('memoryChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Memory MB',
				data: groupedMetrics.memory_usage.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#00d4aa',
				backgroundColor: 'rgba(0, 212, 170, 0.1)',
				fill: true,
				tension: 0.4
			}]
		},
		options: commonOptions
	});

	// Players Chart
	metricsCharts.players = new Chart(document.getElementById('playersChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Players',
				data: groupedMetrics.player_count.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#ff6b6b',
				backgroundColor: 'rgba(255, 107, 107, 0.1)',
				fill: true,
				tension: 0.4,
				stepped: true
			}]
		},
		options: {
			...commonOptions,
			scales: {
				...commonOptions.scales,
				y: {
					...commonOptions.scales.y,
					ticks: {
						...commonOptions.scales.y.ticks,
						stepSize: 1
					}
				}
			}
		}
	});

	// Status Chart (1 = running, 0 = stopped)
	metricsCharts.status = new Chart(document.getElementById('statusChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Status',
				data: groupedMetrics.status.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#ffd93d',
				backgroundColor: 'rgba(255, 217, 61, 0.1)',
				fill: true,
				stepped: true
			}]
		},
		options: {
			...commonOptions,
			scales: {
				...commonOptions.scales,
				y: {
					...commonOptions.scales.y,
					min: 0,
					max: 1,
					ticks: {
						...commonOptions.scales.y.ticks,
						stepSize: 1,
						callback: function(value) {
							return value === 1 ? 'Running' : 'Stopped';
						}
					}
				}
			}
		}
	});

	// Response Time Chart
	metricsCharts.responseTime = new Chart(document.getElementById('responseTimeChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Response Time (ms)',
				data: groupedMetrics.response_time.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#c44569',
				backgroundColor: 'rgba(196, 69, 105, 0.1)',
				fill: true,
				tension: 0.4
			}]
		},
		options: commonOptions
	});
}

function getTimeUnit(timeframe) {
	switch(timeframe) {
		case 'hour':
			return 'minute';
		case 'today':
		case 'day':
		case 'week':
			return 'hour';
		case 'month':
		case '3month':
			return 'day';
		case '6month':
		case 'year':
			return 'week';
		default:
			return 'hour';
	}
}

function toggleFullscreen() {
	const modalContent = document.querySelector('#metricsModal .modal-content');
	const btn = document.querySelector('#metricsModal .fullscreen-btn i');

	if (!document.fullscreenElement) {
		modalContent.requestFullscreen().catch(err => {
			console.error('Error attempting to enable fullscreen:', err);
		});
		btn.className = 'fas fa-compress';
	} else {
		document.exitFullscreen();
		btn.className = 'fas fa-expand';
	}
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

			// Load all services and periodically update the list
			loadAllServicesAndStats();
			setInterval(loadAllServicesAndStats, 60*1000); // Refresh services every 60 seconds

			setTimeout(checkForUpdates, 10*1000); // Check for updates after 10 seconds
			setInterval(checkForUpdates, 60*15*1000); // Check for updates every 15 minutes

			// Timeframe selector event listeners
			document.querySelectorAll('.timeframe-btn').forEach(btn => {
				btn.addEventListener('click', () => {
					document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
					btn.classList.add('active');
					loadMetrics(btn.dataset.timeframe);
				});
			});

			// Close modal on overlay click
			document.getElementById('metricsModal').addEventListener('click', (e) => {
				if (e.target.id === 'metricsModal') {
					closeMetricsModal();
				}
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


