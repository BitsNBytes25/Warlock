/**
 * Primary handler to load the application on page load
 */

function renderHost(hostData) {
	const hostContainer = document.createElement('div');

	hostContainer.className = 'host-entry';
	hostContainer.dataset.host = hostData.host;
	if (hostData.os.name) {
		let thumbnail = document.createElement('div');
		thumbnail.className = 'thumbnail';
		thumbnail.appendChild(renderHostOSThumbnail(hostData.host));
		hostContainer.appendChild(thumbnail);
	}

	// Hostname
	const hostnameContainer = document.createElement('div')
	hostnameContainer.className = 'hostname';
	if (hostData.os.title) {
		const icon = renderHostIcon(hostData.host);
		hostnameContainer.innerHTML = `${icon} ${hostData.hostname}`;
	}
	else {
		hostnameContainer.innerHTML = hostData.hostname;
	}
	hostContainer.appendChild(hostnameContainer);

	// IP
	const ipContainer = document.createElement('div');
	ipContainer.className = 'ip';
	ipContainer.innerHTML = hostData.host;
	hostContainer.appendChild(ipContainer);


	// Connected/Disconnected Status
	const status = document.createElement('div');
	status.className = 'metric-item metric-status status';
	status.innerHTML = `<host-connected-metric host="${hostData.host}" data-title="ON: "></host-connected-metric>`;
	hostContainer.appendChild(status);

	// CPU
	const cpu = document.createElement('div');
	cpu.className = 'metric-item metric-cpu cpu';
	cpu.innerHTML = `<host-cpu-metric host="${hostData.host}" model="1" bargraph="1" data-title="CPU: "></host-cpu-metric>`;
	hostContainer.appendChild(cpu);

	// Memory
	const memory = document.createElement('div');
	memory.className = 'metric-item metric-memory memory';
	memory.innerHTML = `<host-memory-metric host="${hostData.host}" bargraph="1" data-title="MEM: "></host-memory-metric>`;
	hostContainer.appendChild(memory);

	// Disks
	const disks = document.createElement('div');
	disks.className = 'metric-item metric-disks disks';
	disks.innerHTML = `<host-disks-metric host="${hostData.host}" bargraph="1" data-title="DISKS: "></host-disks-metric>`;
	hostContainer.appendChild(disks);

	const msg = document.createElement('p');
	msg.className = 'compatible-message';
	hostContainer.appendChild(msg);

	return hostContainer;
}

window.addEventListener('DOMContentLoaded', () => {

	const applicationSelect = document.getElementById('selectApplication'),
		selectedApplicationDetails = document.getElementById('selectedApplicationDetails');

	// Clear on first load
	applicationSelect.value = '';

	applicationData.forEach(app => {
		const option = document.createElement('option');
		option.value = app.guid;
		option.text = app.title;
		applicationSelect.appendChild(option);
	});

	let hostsTarget = document.getElementById('installAppHostList');
	hostData.forEach(host => {
		// Render each host on page load so they're available for metrics polling.
		hostsTarget.appendChild(renderHost(host));
	});

	applicationSelect.addEventListener('change', () => {
		const selectedApp = applicationSelect.value;
		loadApplication(selectedApp).then(app => {
			let appUrl = null, appUrlLabel = null, html = '',
				supportedPlatforms = {};

			if (app.source === 'github' && app.repo) {
				appUrl = `https://github.com/${app.repo}`;
				appUrlLabel = `${app.repo} on GitHub`;
			}

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

			// Skip any host already set as having the selected application installed
			// and any hosts which are not in the supportedPlatforms list
			// We just need to check the platform.  If the version mismatches simply provide a warning.
			let hostsHTML = '';
			hostData.forEach(host => {
				const hostCard = document.querySelector('.host-entry[data-host="' + host.host + '"]');
				if (!hostCard) {
					return;
				}
				const msg = hostCard.querySelector('.compatible-message');

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

				if (app.installs) {
					if (app.installs.map(h => h.host).includes(host.host)) {
						compatibleNotice = 'Already Installed';
					}
				}

				if (isCompatible) {
					hostCard.classList.add('compatible-host');
					if (compatibleNotice) {
						msg.classList.add('warning-message');
						msg.classList.remove('error-message', 'success-message');
						msg.textContent = compatibleNotice;
					} else {
						msg.classList.add('success-message');
						msg.classList.remove('error-message', 'warning-message');
						msg.textContent = 'Compatible host';
					}
				}
				else {
					msg.classList.add('error-message');
					msg.classList.remove('success-message', 'warning-message');
					msg.textContent = compatibleNotice || 'Incompatible host';
				}

				// Render the host record regardless of compatability.
				// This provides UX feedback that they can see the host, but it is not compatible.
				hostsHTML += renderHost(host, isCompatible, compatibleNotice);
			});

			//document.getElementById('installAppHostList').innerHTML = hostsHTML;
			document.getElementById('targetHostsContainer').style.display = 'block';
		});
	});

	// Start the watcher for metric changes in hosts.
	pollHostsMetrics();
});


document.getElementById('targetHostsContainer').addEventListener('click', (e) => {
	let hostCard = null;

	if (e.target && e.target.classList.contains('host-entry')) {
		hostCard = e.target;
	}
	else if (e.target && e.target.closest('.host-entry')) {
		hostCard = e.target.closest('.host-entry');
	}

	if (hostCard && hostCard.classList.contains('compatible-host')) {
		window.location.href = `/application/install/${loadedApplication}/${hostCard.dataset.host}`;
	}
});