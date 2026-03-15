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
 * Poll host status from the API
 */
function pollHostStatus(host) {
	fetchHosts().then(hosts => {
		const hostData = hosts[host];
		if (!hostData) {
			console.error('Host not found in API response');
			return;
		}

		hostDataCache = hostData;


		// Disk usage
		if (hostData.disks && hostData.disks.length > 0) {
			hostData.disks.forEach(disk => {
				let diskContainer = hostDetailOverview.querySelector('[data-disk="' + disk.filesystem + '"]');
				if (!diskContainer) {
					// Create new disk entry
					diskContainer = document.createElement('div');
					diskContainer.dataset.disk = disk.filesystem;
					diskContainer.classList.add('host-disk');
					hostDetailOverview.appendChild(diskContainer);
				}
				let diskPct = Math.min(100, ((disk.used / disk.size) * 100).toFixed(1)),
					diskStatus = 'good';
				if (diskPct >= 80) {
					diskStatus = 'critical';
				}
				else if (diskPct >= 60) {
					diskStatus = 'warning';
				}
				diskContainer.innerHTML = `<div class="label">Disk ${disk.mountpoint} (${disk.filesystem})</div>
<div class="value">${formatFileSize(disk.used)} / ${formatFileSize(disk.size)}</div>
<div class="bargraph-h"><div class="fill ${diskStatus}" style="width: ${diskPct}%"></div></div>`;
			});
		}
	}).catch(error => {
		console.error('Error fetching host data:', error);
	});
}

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
		loadDirectory('/');
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

		console.log(hostData);

		const appCard = `
			<div class="application-card">
				<div class="application-header">
					<img src="${thumbnail}" alt="${app.title}" class="app-thumbnail">
					<div class="app-info">
						<h3>${app.title}</h3>
						<ul>
							<li>Install Directory: ${hostData.path}</li>
							<li>API Version: ${hostData.version}</li>
						</ul>
					</div>
					<div class="actions">
						<button>Remove</button>
						<button>Browse Files</button>
						<button>Reinstall</button>
					</div>
				</div>
			</div>
		`;

		applicationsContainer.insertAdjacentHTML('beforeend', appCard);
	});
}

/**
 * Load metrics placeholder
 */
function loadMetricsPlaceholder() {
	// Placeholder for future metrics implementation
	console.log('Metrics tab activated - placeholder for now');
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
