const hostDetailsUptime = document.getElementById('hostDetailsUptime'),
	hostDetailsCpu = document.getElementById('hostDetailsCpu'),
	hostDetailsMemory = document.getElementById('hostDetailsMemory'),
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

		// Update overview stats
		hostPublicIP.innerText = hostDataCache.public_ip || 'N/A';
		hostOSInfo.innerText = hostDataCache.os ? `${hostDataCache.os.title} ${hostDataCache.os.version || ''}` : 'Unknown';
		hostKernel.innerText = hostDataCache.os ? hostDataCache.os.kernel : 'N/A';
		hostCPUModel.innerText = hostDataCache.cpu ? (hostDataCache.cpu.model || 'N/A') : 'N/A';
		hostCPUCores.innerText = hostDataCache.cpu ? `${hostDataCache.cpu.threads || 0} threads (${hostDataCache.cpu.count || 0} CPU)` : 'N/A';
		hostMemoryTotal.innerText = hostDataCache.memory ? formatFileSize(hostDataCache.memory.total) : 'N/A';

		// CPU usage (use load average as percentage relative to thread count)
		if (hostData.cpu && hostData.cpu.threads > 0) {
			const cpuPct = Math.min(100, (hostData.cpu.load1m / hostData.cpu.threads) * 100).toFixed(1);
			hostDetailsCpu.innerText = `${cpuPct}%`;
		}

		// Memory usage
		if (hostData.memory) {
			const used = hostData.memory.used,
				total = hostData.memory.total;
			hostDetailsMemory.innerText = `${formatFileSize(used)} / ${formatFileSize(total)}`;
		}

		// Disk usage
		if (hostData.disks && hostData.disks.length > 0) {
			let totalSize = 0, totalAvail = 0;
			hostData.disks.forEach(disk => {
				let diskContainer = hostDetailOverview.querySelector('[data-disk="' + disk.filesystem + '"]');
				if (!diskContainer) {
					// Create new disk entry
					diskContainer = document.createElement('div');
					diskContainer.dataset.disk = disk.filesystem;
					diskContainer.classList.add('host-disk');
					hostDetailOverview.appendChild(diskContainer);
				}
				diskContainer.innerHTML = `<div class="label">Disk ${disk.mountpoint} (${disk.filesystem})</div>
<div class="value">${formatFileSize(disk.used)} / ${formatFileSize(disk.size)}</div>`;
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
		loadMetricsPlaceholder();
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

	const host = loadedHost;

	fetchServices().then(services => {
		let hostApps = [];

		services.forEach(svc => {
			if (svc.host.host === host) {
				hostApps.push(svc);
			}
		});

		if (hostApps.length === 0) {
			applicationsContainer.innerHTML = '<div class="warning-message">No applications installed on this host.</div>';
			return;
		}

		return;
		// @todo

		let servicesHtml = '';
		const serviceCount = hostApps.length;
		hostApps.forEach(service => {
			servicesHtml += `
				<div class="service-item">
					<a href="/service/details/${app.guid}/${host}/${service.service}" class="service-link">
						<i class="fas fa-server"></i>
						<span>${service.name || service.service}</span>
						<span class="service-status status-${service.status || 'unknown'}">${service.status || 'unknown'}</span>
					</a>
				</div>
			`;

			const appCard = `
				<div class="application-card">
					<div class="application-header">
						<img src="${app.thumbnail || app.icon || ''}" alt="${app.title}" class="app-thumbnail">
						<div class="app-info">
							<h3>${app.title}</h3>
							<p>${serviceCount} service${serviceCount !== 1 ? 's' : ''}</p>
						</div>
					</div>
					<div class="application-services">
						${servicesHtml}
					</div>
				</div>
			`;

			applicationsContainer.insertAdjacentHTML('beforeend', appCard);
		});
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
 * Load cron jobs
 */
function loadCronJobs() {
	const cronContainer = document.getElementById('cronJobsContainer');
	if (!cronContainer) return;

	cronContainer.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Loading cron jobs...</div>';

	fetch(`/api/cron/${loadedHost}`)
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				renderCronJobs(data.jobs);
			} else {
				cronContainer.innerHTML = `<div class="error-message">${data.error || 'Error loading cron jobs'}</div>`;
			}
		})
		.catch(error => {
			console.error('Error loading cron jobs:', error);
			cronContainer.innerHTML = '<div class="error-message">Error loading cron jobs.</div>';
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
		// Start polling
		pollHostStatus(host);
		pollInterval = setInterval(() => {
			pollHostStatus(host);
		}, 1000 * 15);

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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
	if (pollInterval) {
		clearInterval(pollInterval);
	}
});

