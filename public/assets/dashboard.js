const servicesContainer = document.getElementById('servicesContainer'),
	servicesTable = document.getElementById('services-table');

// List of services which are being watched live; these should have the lazy lookups ignored.
let liveServices = [];

/**
 *
 * @param servicesWithStats {app: {string}, host: HostAppData, service: ServiceData}
 */
function populateServicesTable(servicesWithStats) {
	const table = servicesTable,
		now = parseInt(Date.now() / 1000),
		app_guid = servicesWithStats.host.guid,
		host = servicesWithStats.host,
		service = servicesWithStats.service;

	let row,
		fields = ['thumbnail', 'host', 'icon', 'name', 'enabled', 'status', 'port', 'players', 'memory', 'cpu', 'actions'],
		appIcon = renderAppIcon(app_guid),
		supportsDelayedStop = host.options.includes('delayed-stop') ? '1' : '0',
		supportsDelayedRestart = host.options.includes('delayed-restart') ? '1' : '0';

	// Create new row
	row = document.createElement('div');
	row.className = 'service-entry';
	row.setAttribute('data-host', host.host);
	row.setAttribute('data-service', service.service);
	table.querySelector('.body').appendChild(row);

	// Initialize default cells
	fields.forEach(field => {
		const cell = document.createElement('div');
		cell.className = field;

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
		else if (field === 'enabled') {
			val = `<div class="">
	<button style="display:none;" title="Enabled at Boot, click to disable" data-host="${host.host}" data-service="${service.service}" data-action="disable" data-guid="${app_guid}" class="service-control action-start">
		<i class="fas fa-check-circle"></i>
	</button>
	<button style="display:none;" title="Disabled at Boot, click to enable" data-host="${host.host}" data-service="${service.service}" data-action="enable" data-guid="${app_guid}" class="service-control action-stop">
		<i class="fas fa-times-circle"></i>
	</button>
</div>`;
		}
		else if (field === 'players') {
			cell.dataset.players = service.player_count || 0;
			cell.dataset.maxPlayers = service.max_players || 0;
		}
		else if (field === 'actions') {
			val = `<div class="">
	<button title="Game Details" data-href="/service/details/${app_guid}/${host.host}/${service.service}" class="link-control action-view">
		<i class="fas fa-cog"></i><span>Details</span>
	</button>
	<button style="display:none;" title="Stop Game" data-host="${host.host}" data-service="${service.service}" data-guid="${app_guid}" data-support-delayed-stop="${supportsDelayedStop}" data-support-delayed-restart="${supportsDelayedRestart}" class="open-stop-modal action-stop">
		<i class="fas fa-stop"></i><span>Stop</span>
	</button>
	<button style="display:none;" title="Start Game" data-host="${host.host}" data-service="${service.service}" data-action="start" data-guid="${app_guid}" class="service-control action-start">
		<i class="fas fa-play"></i><span>Start</span>
	</button>
</div>`;
		}
		else if (field === 'icon') {
			val = appIcon;
		}

		cell.innerHTML = val;

		row.appendChild(cell);
	});

	row.dataset.updated = String(now); // Mark as found
	row.classList.remove('updating');

	// Services have been loaded, (at least one), remove "no services" and "services loading" messages
	if (table.querySelector('div.no-services-available')) {
		table.querySelector('div.no-services-available').remove();
	}
	table.querySelectorAll('div.service-loading').forEach(row => {
		row.remove();
	});
}

function noServicesAvailable() {
	const body = servicesTable.querySelector('.body'),
		row = document.createElement('div');

	body.innerHTML = ''; // Clear existing rows

	row.className = 'service no-services-available';
	row.innerHTML = '<p class="warning-message">No services available. Please install applications to manage their services here.</p>';
	body.appendChild(row);
}

function noHostsAvailable() {
	const body = servicesTable.querySelector('.body'),
		row = document.createElement('div');

	body.innerHTML = ''; // Clear existing rows

	// Disable the "install game" button (as no host available for installation)
	document.querySelector('.content-header-buttons .action-create').style.display = 'none';

	row.className = 'service no-services-available';
	row.innerHTML = '<div class="warning-message"><p>No hosts available. Please <a href="/host/add">add a host</a> to manage applications and services..</p></div>';
	body.appendChild(row);
}

/**
 * Load all services and their stats
 */
function loadAllServicesAndStats() {
	return fetch('/api/services', {method: 'GET'})
		.then(r => r.json())
		.then(results => {
			if (results.success && results.services.length > 0) {
				results.services.forEach(s => {
					populateServicesTable(s);
				});
			}
			else {
				console.error('Error loading services.', results);
				noServicesAvailable();
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
				row = servicesContainer.querySelector(`div[data-host="${host}"][data-service="${service}"]`);

			e.preventDefault();

			closeModal(stopModal);
			row.classList.add('updating');

			if (action === 'delayed-stop' || action === 'delayed-restart') {
				// Delayed actions do not trigger live stats streaming
				showToast('success', `Issuing ${action.replace('-', ' ')} to ${service}, task may take up to an hour to complete.`);
				serviceAction(guid, host, service, action).then(() => {
					row.classList.remove('updating');
				});
			}
			else {
				showToast('success', `Issuing ${action.replace('-', ' ')} to ${service}, please wait a moment.`);
				serviceAction(guid, host, service, action).then(() => {
					row.classList.remove('updating');
				});
			}
		}
		else if (e.target.classList.contains('link-control') || e.target.closest('.link-control')) {
			let btn = e.target.classList.contains('link-control') ? e.target : e.target.closest('.link-control'),
				href = btn.dataset.href;

			e.preventDefault();

			window.location.href = href;
		}
		else if (e.target.classList.contains('open-stop-modal') || e.target.closest('.open-stop-modal')) {
			let btn = e.target.classList.contains('open-stop-modal') ? e.target : e.target.closest('.open-stop-modal'),
				service = btn.dataset.service,
				host = btn.dataset.host,
				guid = btn.dataset.guid;

			openServiceStopModal(guid, host, service);
		}
	}
});

document.querySelectorAll('.view-changer').forEach(btn => {
	btn.addEventListener('click', () => {
		servicesTable.classList.remove('card-view', 'table-view');
		servicesTable.classList.add(btn.dataset.view);
		localStorage.setItem('dashboard-services-view', btn.dataset.view);
	});
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

	if (hostData.length === 0) {
		noHostsAvailable();
		return;
	}

	// Load all services and then periodically update the list
	loadAllServicesAndStats().then(() => {
		pollServices();
	});
	populateCreateServiceModal(applicationData);
});

document.addEventListener('serviceChange', e => {
	const row = servicesContainer.querySelector(`div[data-host="${e.detail.host}"][data-service="${e.detail.service}"]`);
	if (!row) {
		return;
	}

	if (e.detail.hasOwnProperty('status')) {
		let cell = row.querySelector('.status');

		cell.classList.remove('status-stopped', 'status-stopping', 'status-starting', 'status-running');
		cell.classList.add('status-' + e.detail.status);
		if (e.detail.status === 'running') {
			cell.innerHTML = '<i class="fas fa-check-circle"></i> RUNNING';
			row.querySelector('button[data-action="start"]').style.display = 'none';
			row.querySelector('.open-stop-modal').style.display = 'inline-flex';
		}
		else if (e.detail.status === 'stopped') {
			cell.innerHTML = '<i class="fas fa-times-circle"></i> STOPPED';
			row.querySelector('button[data-action="start"]').style.display = 'inline-flex';
			row.querySelector('.open-stop-modal').style.display = 'none';
		}
		else if (e.detail.status === 'starting') {
			cell.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> STARTING';
			row.querySelector('button[data-action="start"]').style.display = 'none';
			row.querySelector('.open-stop-modal').style.display = 'inline-flex';
		}
		else if (e.detail.status === 'stopping') {
			cell.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> STOPPING';
			row.querySelector('button[data-action="start"]').style.display = 'none';
			row.querySelector('.open-stop-modal').style.display = 'none';
		}
		else {
			cell.innerHTML = '<i class="fas fa-question-circle"></i> UNKNOWN';
			row.querySelector('button[data-action="start"]').style.display = 'none';
			row.querySelector('.open-stop-modal').style.display = 'none';
		}
	}

	if (e.detail.hasOwnProperty('enabled')) {
		if (e.detail.enabled) {
			row.querySelector('button[data-action="enable"]').style.display = 'none';
			row.querySelector('button[data-action="disable"]').style.display = 'inline-flex';
		}
		else {
			row.querySelector('button[data-action="enable"]').style.display = 'inline-flex';
			row.querySelector('button[data-action="disable"]').style.display = 'none';
		}
	}

	if (e.detail.hasOwnProperty('players')) {
		let cell = row.querySelector('.players');
		cell.dataset.players = e.detail.players;
		cell.innerHTML = `${cell.dataset.players || 0} / ${cell.dataset.maxPlayers}`;
	}

	if (e.detail.hasOwnProperty('max_players')) {
		let cell = row.querySelector('.players');
		cell.dataset.maxPlayers = e.detail.max_players;
		cell.innerHTML = `${cell.dataset.players || 0} / ${cell.dataset.maxPlayers}`;
	}

	if (e.detail.hasOwnProperty('port')) {
		let cell = row.querySelector('.port');
		cell.innerHTML = e.detail.port;
	}

	if (e.detail.hasOwnProperty('memory_usage')) {
		let cell = row.querySelector('.memory');
		numberTick(cell, e.detail.memory_usage * 1024 * 1024, v => formatFileSize(v, 0));
	}

	if (e.detail.hasOwnProperty('cpu_usage')) {
		let cell = row.querySelector('.cpu');
		numberTick(cell, e.detail.cpu_usage, v => v.toFixed(0) + '%');
	}
});
