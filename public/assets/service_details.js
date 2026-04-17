const serviceDetailsStatus = document.getElementById('serviceDetailsStatus'),
	serviceDetailsPlayers = document.getElementById('serviceDetailsPlayers'),
	serviceDetailsCpu = document.getElementById('serviceDetailsCpu'),
	serviceDetailsMemory = document.getElementById('serviceDetailsMemory'),
	serviceDetailsPort = document.getElementById('serviceDetailsPort'),
	btnServiceUpdate = document.getElementById('btnServiceUpdate'),
	btnServiceStart = document.getElementById('btnServiceStart'),
	btnServiceStop = document.getElementById('btnServiceStop'),
	btnServiceRestart = document.getElementById('btnServiceRestart');

function checkUpdates(app_guid, host, service) {
	service = service || null;

	let url = `/api/application/update/${app_guid}/${host}`;
	if (service) {
		url += `/${service}`;
	}

	fetch(url)
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

function activateServiceTab(tab, jumpTo = true) {
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
	else if (tab === 'app-configure') {
		loadAppConfigure();
	}
	else if (tab === 'configure') {
		loadServiceConfigure();
	}
	else if (tab === 'logs') {
		fetchLogs();
	}
	else if (tab === 'mods') {
		loadServiceMods();
	}
	else if (tab === 'files') {
		let defaultPath = loadedServiceData.app_dir ||
			loadedApplicationData.installs.filter(h => h.host === loadedHost)[0].path;
		loadDirectory(defaultPath);
	}
	else if (tab === 'backups') {
		loadBackups();
	}
	else if (tab === 'settings') {
		loadServiceSettings();
	}

	if (jumpTo) {
		// Jump down to the section, useful for mobile views to focus on the selected content.
		setTimeout(() => {
			const tabPosition = content.getBoundingClientRect().top + window.scrollY - document.querySelector('.navbar').offsetHeight ;
			window.scrollTo({
				top: tabPosition,
				behavior: 'smooth'
			});
		}, 100);
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
	closeModal(stopModal);
	closeModal(restartModal);

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

			pollService(app_guid, host, service);

			if (loadedServiceData.multi_binary) {
				// Service supports per-service binaries
				setTimeout(() => {
					checkUpdates(app_guid, host, service);
				}, 1000 * 15);
				setInterval(() => {
					checkUpdates(app_guid, host, service);
				}, 1000 * 60 * 30);
			}
			else {
				setTimeout(() => {
					checkUpdates(app_guid, host);
				}, 1000 * 15);
				setInterval(() => {
					checkUpdates(app_guid, host);
				}, 1000 * 60 * 30);
			}

			if (window.location.hash) {
				const hashTab = window.location.hash.replace('#', '');
				activateServiceTab(hashTab, false);
			}
			else {
				activateServiceTab('metrics', false);
			}

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
					//e.preventDefault();
					const tab = tabBtn.getAttribute('href').replace('#', '');
					activateServiceTab(tab, true);
				});
			});

			btnServiceUpdate.addEventListener('click', () => {
				// Only mutli-binary services should send the service tag, otherwise just the host/app is sufficient.
				let serviceToSend = loadedServiceData.multi_binary ? loadedService : null;
				openUpdateModal(loadedHost, loadedApplication, serviceToSend);
			});

		})
		.catch(e => {
			console.error(e);
			configurationContainer.innerHTML = '<div class="alert error-message" role="alert">Error loading application or host data.</div>';
		});
});

document.addEventListener('serviceChange', e => {
	if (e.detail.hasOwnProperty('status')) {
		if (e.detail.status === 'running') {
			serviceDetailsStatus.innerHTML = '<i class="fas fa-check-circle"></i> Running';
			serviceDetailsStatus.classList.remove('status-stopped', 'status-stopping', 'status-starting');
			serviceDetailsStatus.classList.add('status-running');

			btnServiceStart.style.display = 'none';
			btnServiceStop.style.display = 'inline-flex';
			btnServiceRestart.style.display = 'inline-flex';
		}
		else if (e.detail.status === 'stopped') {
			serviceDetailsStatus.innerHTML = '<i class="fas fa-times-circle"></i> Stopped';
			serviceDetailsStatus.classList.remove('status-running', 'status-stopping', 'status-starting');
			serviceDetailsStatus.classList.add('status-stopped');

			btnServiceStart.style.display = 'inline-flex';
			btnServiceStop.style.display = 'none';
			btnServiceRestart.style.display = 'none';
		}
		else if (e.detail.status === 'starting') {
			serviceDetailsStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Starting';
			serviceDetailsStatus.classList.remove('status-running', 'status-stopped', 'status-stopping');
			serviceDetailsStatus.classList.add('status-starting');

			btnServiceStart.style.display = 'none';
			btnServiceStop.style.display = 'inline-flex';
			btnServiceRestart.style.display = 'none';
		}
		else if (e.detail.status === 'stopping') {
			serviceDetailsStatus.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Stopping';
			serviceDetailsStatus.classList.remove('status-running', 'status-stopping', 'status-starting');
			serviceDetailsStatus.classList.add('status-stopping');

			btnServiceStart.style.display = 'none';
			btnServiceStop.style.display = 'inline-flex';
			btnServiceRestart.style.display = 'none';
		}
		else {
			serviceDetailsStatus.innerHTML = '<i class="fas fa-question-circle"></i> Unknown';
			serviceDetailsStatus.classList.remove('status-running', 'status-stopped', 'status-stopping', 'status-starting');

			btnServiceStart.style.display = 'none';
			btnServiceStop.style.display = 'none';
			btnServiceRestart.style.display = 'none';
		}
	}

	if (e.detail.hasOwnProperty('cpu_usage')) {
		numberTick(serviceDetailsCpu, e.detail.cpu_usage, v => v.toFixed(0) + '%');
	}

	if (e.detail.hasOwnProperty('memory_usage')) {
		numberTick(serviceDetailsMemory, e.detail.memory_usage, v => formatFileSize(v * 1024 * 1024, 0));
	}

	if (e.detail.hasOwnProperty('player_count')) {
		serviceDetailsPlayers.innerText = (e.detail.player_count || 0) + ' / ' + loadedServiceData.max_players;
	}

	if (e.detail.hasOwnProperty('max_players')) {
		serviceDetailsPlayers.innerText = loadedServiceData.player_count + ' / ' + e.detail.max_players;
	}

	if (e.detail.hasOwnProperty('port')) {
		serviceDetailsPort.innerText = e.detail.port;
	}

	if (e.detail.hasOwnProperty('ports')) {
		// There are more details ports available; hide the default port display.
		serviceDetailsPort.closest('.service-port').style.display = 'none';
		const overview = document.querySelector('.service-details-overview');
		for(let port of e.detail.ports) {
			const portTag = port.description.replace(/[^a-zA-Z]/g, '');
			let portElement = overview.querySelector(`.service-port-${portTag}`),
				icons = [];

			if (!portElement) {
				portElement = document.createElement('div');
				portElement.classList.add('service-port');
				portElement.classList.add(`service-port-${portTag}`);
				portElement.innerHTML = `<div class="metric-label">${port.description}</div><div class="metric-value"></div>`;
				overview.appendChild(portElement);
			}

			if (port.global && port.open) {
				icons.push('<i class="fas fa-globe status-good" title="Globally Open"></i>');
			}
			else if (port.global) {
				icons.push('<i class="fas fa-lock status-critical" title="Restricted Access / Limited at Firewall"></i>');
			}
			else if (port.listening) {
				icons.push('<i class="fas fa-lock status-critical" title="Only Listening Locally"></i>');
			}

			if (port.listening) {
				icons.push('<i class="fas fa-check status-good" title="Process Listening"></i>');
			}
			else {
				icons.push('<i class="fas fa-times status-critical" title="Process Closed"></i>');
			}

			if (port.listening && !port.owned) {
				icons.push('<i class="fas fa-exclamation-triangle status-critical" title="Port is owned by another service"></i>');
			}

			portElement.querySelector('.metric-value').innerHTML = `${port.port}/${port.protocol.toUpperCase()} ${icons.join(' ')}`;
		}
	}
});