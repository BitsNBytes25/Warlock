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
		if (event === 'data') {
			// Iterate over the changed keys and handle them if necessary, or just store the updated values
			for( let key in data ) {
				document.dispatchEvent(
					new CustomEvent(
						'serviceChange',
						{
							detail: {
								key: key,
								previous: loadedServiceData ? loadedServiceData[key] : null,
								value: data[key]
							}
						}
					)
				);

				loadedServiceData[key] = data[key];
			}
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
	else if (tab === 'files') {
		let defaultPath = loadedServiceData.app_dir ||
			loadedApplicationData.hosts.filter(h => h.host === loadedHost)[0].path;
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

			pollServiceStatus(app_guid, host, service);

			setTimeout(() => {
				checkUpdates(app_guid, host);
			}, 1000 * 15);
			setInterval(() => {
				checkUpdates(app_guid, host);
			}, 1000 * 60 * 30);

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
	if (e.detail.key === 'status') {
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
			btnServiceStop.style.display = 'inline-flex';
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
	}
	else if (e.detail.key === 'cpu_usage') {
		serviceDetailsCpu.innerText = e.detail.value;
	}
	else if (e.detail.key === 'memory_usage') {
		serviceDetailsMemory.innerText = e.detail.value;
	}
	else if (e.detail.key === 'player_count') {
		serviceDetailsPlayers.innerText = (e.detail.value || 0) + ' / ' + loadedServiceData.max_players;
	}
	else if (e.detail.key === 'max_players') {
		serviceDetailsPlayers.innerText = loadedServiceData.player_count + ' / ' + e.detail.value;
	}
	else if (e.detail.key === 'port') {
		serviceDetailsPort.innerText = e.detail.value;
	}
});