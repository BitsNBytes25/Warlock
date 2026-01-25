const serviceDetailsStatus = document.getElementById('serviceDetailsStatus'),
	serviceDetailsPlayers = document.getElementById('serviceDetailsPlayers'),
	serviceDetailsCpu = document.getElementById('serviceDetailsCpu'),
	serviceDetailsMemory = document.getElementById('serviceDetailsMemory'),
	serviceDetailsPort = document.getElementById('serviceDetailsPort'),
	btnServiceUpdate = document.getElementById('btnServiceUpdate'),
	btnServiceStart = document.getElementById('btnServiceStart'),
	btnServiceStop = document.getElementById('btnServiceStop'),
	btnServiceRestart = document.getElementById('btnServiceRestart');

function pollServiceStatus(app_guid, host, service) {
	stream(`/api/service/stream/${app_guid}/${host}/${service}`, 'GET',{},null,(event, data) => {
		if (event === 'message') {
			try {
				let parsed = JSON.parse(data);

				// Check to see if state changes occurred; if so we should notify anything listening.
				let oldStatus = loadedServiceData ? loadedServiceData.status : null;
				let oldEnabled = loadedServiceData ? loadedServiceData.enabled : null;
				if (parsed.service.status !== oldStatus) {
					document.dispatchEvent(
						new CustomEvent(
							'serviceStatusChange',
							{
								detail: {
									previous: oldStatus,
									value: parsed.service.status
								}
							}
						)
					);
				}
				if (parsed.service.enabled !== oldEnabled) {
					document.dispatchEvent(
						new CustomEvent(
							'serviceEnabledChange',
							{
								detail: {
									previous: oldEnabled,
									value: parsed.service.enabled
								}
							}
						)
					);
				}

				// Cache this in the application state
				loadedServiceData = parsed.service;
				serviceDetailsPlayers.innerText = (parsed.service.player_count || 0) + ' / ' + parsed.service.max_players;
				serviceDetailsCpu.innerText = parsed.service.cpu_usage;
				serviceDetailsMemory.innerText = parsed.service.memory_usage;
				serviceDetailsPort.innerText = parsed.service.port;
				console.log(parsed);
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

function checkUpdates(app_guid, host) {
	fetch(`/api/application/update/${app_guid}/${host}`)
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				if (data.updates) {
					btnServiceUpdate.style.display = 'inline-flex';
				} else {
					btnServiceUpdate.style.display = 'none';
				}
			} else {
				btnServiceUpdate.style.display = 'none';
			}
		});
}

function activateServiceTab(tab) {
	const tabHeader = document.querySelector('nav.tabs-header');

	// Deactivate any active tab first
	tabHeader.querySelectorAll('a').forEach(btn => {
		let t = btn.getAttribute('href').replace('#', '');

		const content = document.getElementById(`service-details-${t}`);

		// Ensure content is hidden by default, useful for first-load
		if (content && t !== tab) {
			content.style.display = 'none';
		}

		if (btn && btn.classList.contains('active')) {
			if (tab !== t) {
				// Only deactivate if not currently active
				deactivateServiceTab(t);
			}
		}
	});

	const btn = tabHeader.querySelector(`a[href="#${tab}"]`),
		content = document.getElementById(`service-details-${tab}`);

	if (btn) {
		btn.classList.add('active');
	}
	if (content) {
		content.style.display = 'block';
	}

	if (tab === 'metrics') {
		loadMetrics();
	}
	else if (tab === 'configure') {
		loadServiceConfigure();
	}
	else if (tab === 'logs') {
		fetchLogs();
	}
	else if (tab === 'files') {
		loadDirectory(loadedApplicationData.hosts.filter(h => h.host === loadedHost)[0].path);
	}
	else if (tab === 'backups') {
		loadBackups();
	}
	else if (tab === 'settings') {
		loadServiceSettings();
	}
}

function deactivateServiceTab(tab) {
	const tabHeader = document.querySelector('nav.tabs-header'),
		btn = tabHeader.querySelector(`a[href="#${tab}"]`),
		content = document.getElementById(`service-details-${tab}`);

	if (btn) {
		btn.classList.remove('active');
	}
	if (content) {
		content.style.display = 'none';
	}

	if (tab === 'metrics') {
		closeMetrics();
	}
	else if (tab === 'logs') {
		closeLogs();
	}
}

function serviceControlAction(btn) {
	let service = loadedService,
		action = btn.dataset.action || null,
		host = loadedHost,
		guid = loadedApplication;

	if (!service || !action || !host || !guid) {
		showToast('error', 'Missing required parameters for service control action.');
		return false;
	}

	showToast('info', `Issuing ${action.replace('-', ' ')} command to ${service}...`);
	stopModal.classList.remove('show');
	restartModal.classList.remove('show');

	serviceAction(guid, host, service, action).then(() => {
		if (action === 'delayed-stop' || action === 'delayed-restart') {
			showToast('success', `Sent ${action.replace('-', ' ')} command to ${service}, task may take up to an hour to complete.`);
		}
		else {
			showToast('success', `Sent ${action.replace('-', ' ')} command to ${service}, please give it a few moments to complete.`);
		}
	});
}


/**
 * Primary handler to load the application on page load
 */
window.addEventListener('DOMContentLoaded', () => {

	const {app_guid, host, service} = getPathParams('/service/details/:app_guid/:host/:service'),
		configurationContainer = document.getElementById('configurationContainer');

	btnServiceUpdate.style.display = 'none';
	btnServiceStart.style.display = 'none';
	btnServiceStop.style.display = 'none';
	btnServiceRestart.style.display = 'none';

	Promise.all([
		loadApplication(app_guid),
		loadHost(host),
		loadService(app_guid, host, service)
	])
		.then(() => {
			btnServiceStart.dataset.service = service;
			btnServiceStart.dataset.host = host;
			btnServiceStart.dataset.guid = app_guid;

			pollServiceStatus(app_guid, host, service);

			setTimeout(() => {
				checkUpdates(app_guid, host);
			}, 1000 * 60);
			setInterval(() => {
				checkUpdates(app_guid, host);
			}, 1000 * 60 * 30);

			activateServiceTab('metrics');

			// Events
			btnServiceStop.addEventListener('click', () => {
				openServiceStopModal(loadedApplication, loadedHost, loadedService);
			});

			btnServiceRestart.addEventListener('click', () => {
				openServiceRestartModal(loadedApplication, loadedHost, loadedService);
			});

			document.querySelectorAll('.service-control').forEach(btn => {
				btn.addEventListener('click', () => {
					serviceControlAction(btn);
				});
			});

			document.querySelectorAll('.tabs-header a').forEach(tabBtn => {
				tabBtn.addEventListener('click', (e) => {
					e.preventDefault();
					const tab = tabBtn.getAttribute('href').replace('#', '');
					activateServiceTab(tab);
				});
			});

		})
		.catch(e => {
			console.error(e);
			configurationContainer.innerHTML = '<div class="alert error-message" role="alert">Error loading application or host data.</div>';
		});
});

document.addEventListener('serviceStatusChange', e => {
	if (e.detail.value === 'running') {
		serviceDetailsStatus.innerHTML = '<i class="fas fa-check-circle"></i> Running';
		serviceDetailsStatus.classList.remove('status-stopped', 'status-stopping', 'status-starting');
		serviceDetailsStatus.classList.add('status-running');

		btnServiceStart.style.display = 'none';
		btnServiceStop.style.display = 'inline-flex';
		btnServiceRestart.style.display = 'inline-flex';
	}
	else if (e.detail.value === 'stopped') {
		serviceDetailsStatus.innerHTML = '<i class="fas fa-times-circle"></i> Stopped';
		serviceDetailsStatus.classList.remove('status-running', 'status-stopping', 'status-starting');
		serviceDetailsStatus.classList.add('status-stopped');

		btnServiceStart.style.display = 'inline-flex';
		btnServiceStop.style.display = 'none';
		btnServiceRestart.style.display = 'none';
	}
	else if (e.detail.value === 'starting') {
		serviceDetailsStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Starting';
		serviceDetailsStatus.classList.remove('status-running', 'status-stopped', 'status-stopping');
		serviceDetailsStatus.classList.add('status-starting');

		btnServiceStart.style.display = 'none';
		btnServiceStop.style.display = 'none';
		btnServiceRestart.style.display = 'none';
	}
	else if (e.detail.value === 'stopping') {
		serviceDetailsStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Stopping';
		serviceDetailsStatus.classList.remove('status-running', 'status-stopping', 'status-starting');
		serviceDetailsStatus.classList.add('status-stopping');

		btnServiceStart.style.display = 'none';
		btnServiceStop.style.display = 'none';
		btnServiceRestart.style.display = 'none';
	}
	else {
		serviceDetailsStatus.innerHTML = '<i class="fas fa-question-circle"></i> Unknown';
		serviceDetailsStatus.classList.remove('status-running', 'status-stopped', 'status-stopping', 'status-starting');

		btnServiceStart.style.display = 'none';
		btnServiceStop.style.display = 'none';
		btnServiceRestart.style.display = 'none';
	}
});