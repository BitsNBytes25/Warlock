const hostDetailsUptime = document.getElementById('hostDetailsUptime'),
	hostDetailsCpu = document.getElementById('hostDetailsCpu'),
	hostDetailsMemory = document.getElementById('hostDetailsMemory'),
	hostDetailsNetwork = document.getElementById('hostDetailsNetwork'),
	btnHostFirewall = document.getElementById('btnHostFirewall'),
	btnHostDelete = document.getElementById('btnHostDelete'),
	hostPublicIP = document.getElementById('hostPublicIP'),
	hostOSInfo = document.getElementById('hostOSInfo'),
	hostKernel = document.getElementById('hostKernel'),
	hostCPUModel = document.getElementById('hostCPUModel'),
	hostCPUCores = document.getElementById('hostCPUCores'),
	hostMemoryTotal = document.getElementById('hostMemoryTotal'),
	hostDetailOverview = document.getElementById('hostDetailOverview');

let hostDataCache = null,
	pollInterval = null;

/**
 * Activate a specific tab
 */
function activateHostTab(tab, jumpTo = true) {
	const tabHeader = document.querySelector('nav.tabs-header');

	// Deactivate all tabs first
	tabHeader.querySelectorAll('a').forEach(btn => {
		let t = btn.getAttribute('href').replace('#', '');
		const content = document.getElementById(`host-details-${t}`);

		if (content && t !== tab) {
			content.style.display = 'none';
		}

		if (btn && btn.classList.contains('active')) {
			if (tab !== t) {
				deactivateHostTab(t);
			}
		}
	});

	const btn = tabHeader.querySelector(`a[href="#${tab}"]`),
		content = document.getElementById(`host-details-${tab}`);

	if (btn) {
		btn.classList.add('active');
	}
	if (content) {
		content.style.display = 'block';
	}

	if (tab === 'overview') {
		loadOverview();
	}
	else if (tab === 'metrics') {
		loadMetrics();
	}
	else if (tab === 'files') {
		if (currentPathEl.textContent === '') {
			loadDirectory('/');
		}
	}
	else if (tab === 'firewall') {
		loadFirewall();
	}
	else if (tab === 'cron') {
		loadCronJobs();
	}
	else if (tab === 'settings') {
		loadHostSettings();
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

/**
 * Deactivate a specific tab
 */
function deactivateHostTab(tab) {
	const tabHeader = document.querySelector('nav.tabs-header'),
		btn = tabHeader.querySelector(`a[href="#${tab}"]`),
		content = document.getElementById(`host-details-${tab}`);

	if (btn) {
		btn.classList.remove('active');
	}
	if (content) {
		content.style.display = 'none';
	}
}

/**
 * Load overview tab content
 */
function loadOverview() {
	const applicationsContainer = document.getElementById('hostApplicationsList');
	if (!applicationsContainer) return;

	applicationsContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Loading applications...</div>';

	hostPublicIP.innerText = loadedHostData.public_ip || 'N/A';
	hostOSInfo.innerText = loadedHostData.os.title || 'Unknown';
	hostKernel.innerText = loadedHostData.os.kernel || 'Unknown';
	hostCPUModel.innerText = loadedHostData.cpu.model || 'N/A';
	let cpuThreadInfo = `${loadedHostData.cpu.threads} threads`;
	if (loadedHostData.cpu.sockets > 1) {
		cpuThreadInfo += ` (${loadedHostData.cpu.sockets} sockets)`;
	}
	hostCPUCores.innerText = cpuThreadInfo;

	// Render the list of applications installed on this host
	let installedAppGUIDs = [];
	applicationData.forEach(app => {
		if (app.installs.find(i => i.host === loadedHostData.host)) {
			installedAppGUIDs.push(app.guid);
		}
	});

	if (installedAppGUIDs.length === 0) {
		applicationsContainer.innerHTML = '<div class="warning-message">No applications installed on this host.</div>';
		return;
	}

	// Clear loading prior to rendering
	applicationsContainer.innerHTML = '';

	installedAppGUIDs.forEach(appGUID => {
		let app = applicationData.find(a => a.guid === appGUID),
			hostData = app.installs.find(i => i.host === loadedHostData.host),
			thumbnail = getAppThumbnail(appGUID);

		const appCard = `
			<div class="application-entry">
				<div class="thumbnail">
					<img src="${thumbnail}" alt="${app.title}" class="app-thumbnail">
				</div>
				<div class="name">${app.title}</div>
				<div class="description">${hostData.path}</div>
				<ul>
					<li>API Version: ${hostData.version}</li>
				</ul>
				<div class="actions">
					<button class="action-remove" data-app="${appGUID}" data-host="${loadedHostData.host}">
						<i class="fas fa-trash-alt"></i>
						Uninstall
					</button>
					<button class="action-browse" data-path="${hostData.path}">
						<i class="fas fa-folder-open"></i>
						Browse Files
					</button>
					<button class="action-edit" data-app="${appGUID}" data-host="${loadedHostData.host}">
						<i class="fas fa-redo"></i>
						Reinstall
					</button>
				</div>
			</div>
		`;

		applicationsContainer.insertAdjacentHTML('beforeend', appCard);
	});

	// Events for application buttons
	applicationsContainer.querySelectorAll('.action-browse').forEach((btn) => {
		btn.addEventListener('click', () => {
			loadDirectory(btn.dataset.path);
			activateHostTab('files');
		});
	});
	applicationsContainer.querySelectorAll('.action-remove').forEach((btn) => {
		btn.addEventListener('click', () => {
			window.location.href = `/application/uninstall/${btn.dataset.app}/${loadedHostData.host}`;
		});
	});
	applicationsContainer.querySelectorAll('.action-edit').forEach((btn) => {
		btn.addEventListener('click', () => {
			window.location.href = `/application/install/${btn.dataset.app}/${loadedHostData.host}`;
		});
	});
}


/**
 * Load host settings
 */
function loadHostSettings() {
	// Placeholder for host settings
	console.log('Settings tab activated');
}

/**
 * Primary handler to load the application on page load
 */
window.addEventListener('DOMContentLoaded', () => {
	const {host} = getPathParams('/host/details/:host');

	// Load host data
	loadHost(host).then(() => {

		hostDetailsCpu.host = host;
		hostDetailsMemory.host = host;
		hostDetailsNetwork.host = host;

		// Start metrics poller
		pollHostMetrics(host);

		loadedHostData.disks.forEach(disk => {
			let diskContainer;

			// Create new disk entry
			diskContainer = document.createElement('div');
			diskContainer.classList.add('host-disk');
			diskContainer.innerHTML = `<div class="metric-label">Disk ${disk.mount} (${disk.type})</div>
<host-disk-metric class="metric-value" host="${host}" dev="${disk.dev}" bargraph="1"></host-disk-metric>`;
			hostDetailOverview.appendChild(diskContainer);
		});


		// Setup button handlers
		/*btnHostFirewall.addEventListener('click', () => {
			window.location.href = `/host/firewall/${host}`;
		});*/

		/*btnHostDelete.addEventListener('click', () => {
			window.location.href = `/host/delete/${host}`;
		});*/

		// Setup tab handlers
		document.querySelectorAll('.tabs-header a').forEach(tabBtn => {
			tabBtn.addEventListener('click', (e) => {
				e.preventDefault();
				const tab = tabBtn.getAttribute('href').replace('#', '');
				activateHostTab(tab, true);
			});
		});

		// Activate default tab
		activateHostTab('overview', false);
	}).catch(error => {
		console.error('Error loading host:', error);
		document.querySelector('.content-body').innerHTML = '<div class="error-message">Error loading host data.</div>';
	});
});
