/**
 * Primary handler to load the application on page load
 */

function renderHost(hostData, isCompatible, compatibleNotice) {
	const hostContainer = document.createElement('div'),
		hostnameContainer = document.createElement('div'),
		metricsContainer = document.createElement('div');

	hostContainer.className = 'host-card';
	if (isCompatible) {
		hostContainer.classList.add('compatible-host');
		hostContainer.dataset.host = hostData.ip;
	}
	metricsContainer.className = 'host-metrics-list';

	// Hostname
	hostnameContainer.className = 'host-title';
	if (hostData.os.title) {
		const os = document.createElement('div');
		os.className = 'host-icon';
		os.innerHTML = renderHostIcon(hostData.ip);
		hostnameContainer.appendChild(os);
	}
	const hostname = document.createElement('h4');
	hostname.className = 'host-name';
	hostname.textContent = hostData.hostname || 'Unknown';
	hostnameContainer.appendChild(hostname);

	// IP
	const ip = document.createElement('div');
	ip.className = 'host-desc';
	ip.textContent = hostData.ip || '';
	hostnameContainer.appendChild(ip);

	// CPU
	const cpu = document.createElement('div');
	cpu.className = 'metric-item metric-cpu';
	cpu.innerHTML = `CPU: ${hostData.cpu.usage}%`;
	metricsContainer.appendChild(cpu);

	// Memory
	const memory = document.createElement('div');
	memory.className = 'metric-item metric-memory';
	// Memory values
	const used = Number(hostData.memory.used || 0);
	const total = Number(hostData.memory.total || 0) || 1;
	memory.innerHTML = `Memory: ${formatFileSize(total - used)} free`;
	metricsContainer.appendChild(memory);

	// Disks
	hostData.disks.forEach(disk => {
		const diskDiv = document.createElement('div');
		diskDiv.className = 'metric-item metric-disk';
		diskDiv.innerHTML = `Disk (${disk.mountpoint}): ${formatFileSize(disk.avail)} free`;
		metricsContainer.appendChild(diskDiv);
	});

	hostContainer.appendChild(hostnameContainer);
	hostContainer.appendChild(metricsContainer);

	const msg = document.createElement('p');
	if (!isCompatible) {
		msg.className = 'error-message';
		if (compatibleNotice) {
			msg.textContent = compatibleNotice;
		} else {
			msg.textContent = 'Incompatible host';
		}
	}
	else {
		if (compatibleNotice) {
			msg.className = 'warning-message';
			msg.textContent = compatibleNotice;
		} else {
			msg.className = 'success-message';
			msg.textContent = 'Compatible host';
		}
	}

	hostContainer.appendChild(msg);

	return hostContainer.outerHTML;
}

window.addEventListener('DOMContentLoaded', () => {

	fetchApplications().then(applications => {
		const applicationSelect = document.getElementById('selectApplication'),
			selectedApplicationDetails = document.getElementById('selectedApplicationDetails');

		Object.keys(applications).forEach((key) => {
			const option = document.createElement('option');
			option.value = key;
			option.text = applications[key].title;
			applicationSelect.appendChild(option);
		});

		applicationSelect.addEventListener('change', () => {
			const selectedApp = applicationSelect.value;
			loadApplication(selectedApp).then(app => {
				console.log(app);

				let appUrl = null, appUrlLabel = null, html = '',
					supportedPlatforms = {};

				if (app.source === 'github' && app.repo) {
					appUrl = `https://github.com/${app.repo}`;
					appUrlLabel = `${app.repo} on GitHub`;
				}

				html += `<h5>${app.title}</h5>`;
				if (appUrl) {
					html += `<p><strong>Source:</strong> <a href="${appUrl}" target="_blank" rel="noopener">${appUrlLabel}</a></p>`;
				}
				if (app.author) {
					if (app.author.includes('@') && app.author.includes('<')) {
						const authorMatch = app.author.match(/(.*)<(.*)>/);
						if (authorMatch) {
							const authorName = authorMatch[1].trim();
							const authorEmail = authorMatch[2].trim();
							html += `<p><strong>Author:</strong> ${authorName} <a href="mailto:${authorEmail}"><i class="fas fa-envelope"></i></a></p>`;
						 } else {
							html += `<p><strong>Author:</strong> ${app.author}</p>`;
						 }
					}
				}
				if (app.supports) {
					html += `<p><strong>Supports:</strong></p><ul>`;
					app.supports.forEach(support => {
						html += `<li>${support}</li>`;
						// Support is a general format, usually something like "Debian 12, 13" or "Ubuntu 20.04, 22.04"
						// We can parse this to populate supportedPlatforms
						const parts = support.split(' ');
						if (parts.length >= 2) {
							const platform = parts[0].toLowerCase();
							const versions = parts.slice(1).join(' ').split(',').map(v => v.trim());
							if (!supportedPlatforms[platform]) {
								supportedPlatforms[platform] = new Set();
							}
							versions.forEach(version => supportedPlatforms[platform].add(version));
						}
						else {
							// At least add the platform with no versions
							const platform = support.toLowerCase();
							if (!supportedPlatforms[platform]) {
								supportedPlatforms[platform] = new Set();
							}
						}
					});
					html += `</ul>`;
				}

				selectedApplicationDetails.style.display = 'block';
				selectedApplicationDetails.innerHTML = html;

				console.log(supportedPlatforms);
				fetchHosts().then(hosts => {
					// Skip any host already set as having the selected application installed
					// and any hosts which are not in the supportedPlatforms list
					// We just need to check the platform.  If the version mismatches simply provide a warning.
					let hostsHTML = '';
					Object.values(hosts).forEach(host => {
						let compatibleNotice = null, isCompatible = true;

						// Check if host platform is supported
						if (host.os.name) {
							const hostOsName = host.os.name.toLowerCase();

							if (Object.keys(supportedPlatforms).length > 0) {
								if (supportedPlatforms[hostOsName]) {
									// Platform is supported, now check version
									if (host.os.version) {
										const supportedVersions = Array.from(supportedPlatforms[hostOsName]);
										if (supportedVersions.length > 0 && !supportedVersions.includes(host.os.version)) {
											compatibleNotice = 'Server host may not be compatible with installer';
										}
									}
								} else {
									compatibleNotice = `Unsupported Platform`;
									isCompatible = false;
								}
							} else {
								compatibleNotice = 'Unknown compatibility';
							}
						}

						if (app.hosts) {
							if (app.hosts.map(h => h.host).includes(host.ip)) {
								compatibleNotice = 'Already Installed';
								isCompatible = false;
							}
						}

						// Render the host record regardless about compatiblity.
						// This provides UX feedback that they can see the host but it is not compatible.
						hostsHTML += renderHost(host, isCompatible, compatibleNotice);
					});

					document.getElementById('installAppHostList').innerHTML = hostsHTML;
					document.getElementById('targetHostsContainer').style.display = 'block';
					console.log(hosts);
				});
			});
		});
	}).catch(e => {
		console.error(e);
		//document.querySelector('.content-body').innerHTML = '<div class="alert alert-danger" role="alert">Error loading applications.</div>';
	});
});


document.getElementById('targetHostsContainer').addEventListener('click', (e) => {
	let hostCard = null;

	if (e.target && e.target.classList.contains('host-card')) {
		hostCard = e.target;
	}
	else if (e.target && e.target.closest('.host-card')) {
		hostCard = e.target.closest('.host-card');
	}

	if (hostCard && hostCard.classList.contains('compatible-host')) {
		window.location.href = `/application/install/${loadedApplication}/${hostCard.dataset.host}`;
	}
});