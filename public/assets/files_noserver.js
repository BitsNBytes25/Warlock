function displayHostsWithApplications(hosts, applications) {
	const container = document.getElementById('hostsList');

	if (Object.keys(hosts).length === 0) {
		container.innerHTML = `
			<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #666;">
				<i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
				<p>No hosts configured!</p>
			</div>
		`;
		return;
	}

	let html = '';
	for (const [host, hostData] of Object.entries(hosts)) {
		console.debug(hostData);
		// Extract the last folder name from the path
		let //pathParts = app.path.split('/').filter(part => part.length > 0),
			displayName = hostData.hostname || host,
			icon = renderHostIcon(host),
			thumbnail = null,
			thumbnailFallback = [];

		if (hostData.os.name && hostData.os.version) {
			thumbnail = `/assets/media/wallpapers/servers/${hostData.os.name.toLowerCase()}_${hostData.os.version.toLowerCase()}.webp`;
		}
		thumbnailFallback = '/assets/media/wallpapers/servers/generic.webp';

		if (thumbnail) {
			thumbnail = '<img class="os-thumbnail" src="' + thumbnail + '" alt="' + displayName + ' Thumbnail" onerror="this.onerror=null;this.src=\'' + thumbnailFallback + '\';">';
		}
		else {
			thumbnail = '<img class="os-thumbnail" src="' + thumbnailFallback + '" alt="' + displayName + ' Thumbnail">';
		}

		html += `
			<div class="host-card">
				${thumbnail}
				<div class="host-name">
					<div class="host-icon">
						${icon}
					</div>
					<div style="flex: 1;">
						<h4>${displayName}</h4>
					</div>
				</div>`;

		// Add the list of file systems on this host along with a pretty bargraph of disk usage
		if (hostData.disks && hostData.disks.length > 0) {
			html += `<div class="host-disks"><h5>Filesystems</h5>`;
			hostData.disks.forEach(fs => {
				let usagePercent = fs.size > 0 ? (fs.used / fs.size) * 100 : 0,
					usageStatus;

				if (usagePercent >= 90) {
					usageStatus = 'critical';
				}
				else if (usagePercent >= 75) {
					usageStatus = 'warning';
				}
				else {
					usageStatus = 'normal'
				}

				html += `<div class="filesystem link-control" data-href="/files/${host}?path=${fs.mountpoint}" title="Browse ${fs.mountpoint}">
					<div class="filesystem-row-header">
						<div class="filesystem-path" title="${fs.mountpoint}">${fs.mountpoint}</div>
					</div>
					
					<div class="filesystem-usage-bar">
						<div class="usage-fill usage-status-${usageStatus}" style="width: ${usagePercent}%;"></div>
						<div class="filesystem-usage-text">${formatFileSize(fs.used)} / ${formatFileSize(fs.size)} (${usagePercent.toFixed(1)}%)</div>
					</div>
				</div>`;
			});
			html += `</div>`;
		}

		// Add any application installed on this host
		html += '<div class="app-installs"><h5>Games Installed</h5>';
		for (const [guid, app] of Object.entries(applications)) {
			let isInstalled = app.hosts.some(h => h.host === host);
			if (isInstalled) {
				let gamePath = app.hosts.find(h => h.host === host).path;
				html += `<div class="app-install link-control" data-href="/files/${host}?path=${gamePath}" title="Browse Files">
					<span class="app-name">${renderAppIcon(guid)} ${app.title || guid}</span>
				</div>`;
			}
		}

		html += `</div></div>`;
	}

	container.innerHTML = html;
}

// Load on page load
window.addEventListener('DOMContentLoaded', () => {
	fetchHosts().then(hosts => {
		fetchApplications().then(applications => {
			// Display hosts
			displayHostsWithApplications(hosts, applications);
		}).catch(error => {
			document.getElementById('hostsList').innerHTML = `<div style="grid-column:1/-1;"><p class="error-message">${error}</p></div>`;
			console.error('Error fetching applications:', error);
		});
	}).catch(error => {
		document.getElementById('hostsList').innerHTML = `<div style="grid-column:1/-1;"><p class="error-message">${error}</p></div>`;
		console.error('Error fetching hosts:', error);
	});
});

// Dynamic events for various buttons
document.addEventListener('click', e => {
	if (e.target) {

		if (e.target.classList.contains('link-control') || e.target.closest('.link-control')) {
			let btn = e.target.classList.contains('link-control') ? e.target : e.target.closest('.link-control'),
				href = btn.dataset.href;

			e.preventDefault();

			window.location.href = href;
		}
	}

});