const hostsContainer = document.getElementById('hostsContainer'),
	hostsTable = document.getElementById('hosts-table');

/**
 * Populate hosts table with host data
 * @param {string} host
 * @param {HostData} hostData
 */
function populateHostsTable(host, hostData) {
	const table = hostsTable,
		now = parseInt(Date.now() / 1000);

	let row = table.querySelector('div.host[data-host="' + host + '"]'),
		fields = ['thumbnail', 'hostname', 'ip', 'os', 'cpu', 'memory', 'disk', 'actions'];

	if (!row) {
		// Create new row
		row = document.createElement('div');
		row.className = 'host';
		row.setAttribute('data-host', host);
		table.querySelector('.body').appendChild(row);

		// Initialize empty cells
		fields.forEach(field => {
			const cell = document.createElement('div');
			cell.className = field;
			row.appendChild(cell);
		});
	}

	row.dataset.updated = String(now);

	// Calculate metrics
	const used = Number(hostData.memory.used || 0),
		total = Number(hostData.memory.total || 0) || 1,
		memPct = Math.max(0, Math.min(100, (used / total) * 100)),
		cpuPct = Math.max(0, Math.min(100, Number(hostData.cpu.usage) || 0));

	let totalDisk = 0, totalAvail = 0;
	hostData.disks.forEach(disk => {
		totalDisk += Number(disk.size || 0);
		totalAvail += Number(disk.avail || 0);
	});
	const totalUsed = Math.max(0, totalDisk - totalAvail),
		diskPct = totalDisk > 0 ? Math.round((totalUsed / totalDisk) * 100) : 0;

	// Prepare action buttons
	let actionButtons = [];
	actionButtons.push(`
<button title="Host Details" data-href="/host/details/${encodeURIComponent(host)}" class="link-control action-view">
<i class="fas fa-info-circle"></i><span>Details</span>
</button>`);

	// Populate cells
	fields.forEach(field => {
		const cell = row.querySelector('div.' + field);
		let val = '';

		if (field === 'thumbnail') {
			val = renderHostOSThumbnail(host).outerHTML;
		}
		else if (field === 'hostname') {
			val = `${renderHostIcon(host)} <span>${hostData.hostname || host}</span>`;
		}
		else if (field === 'ip') {
			let rawIp = hostData.ip || '',
				publicIp = hostData.public_ip || '',
				ipDisplay = rawIp;

			if (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp.toLowerCase() === 'localhost' || rawIp.startsWith('127.')) {
				if (publicIp) {
					ipDisplay = publicIp;
				} else {
					ipDisplay = hostData.hostname || rawIp || '';
				}
			}
			val = ipDisplay;
		}
		else if (field === 'os') {
			val = hostData.os ? hostData.os.title : 'Unknown';
		}
		else if (field === 'cpu') {
			let cpuStatusClass = 'good';
			if (memPct >= 80) {
				cpuStatusClass = 'critical';
			}
			else if (memPct >= 60) {
				cpuStatusClass = 'warning';
			}

			val = `${cpuPct}%`;
			// Add CPU details for card view
			if (hostData.cpu.model) {
				val += `<div class="cpu-details">${hostData.cpu.model}</div>`;
				val += `<div class="bargraph-h"><div class="fill ${cpuStatusClass}" style="width: ${cpuPct}%"></div></div>`;
			}
		}
		else if (field === 'memory') {
			let memStatusClass = 'good';
			if (memPct >= 80) {
				memStatusClass = 'critical';
			}
			else if (memPct >= 60) {
				memStatusClass = 'warning';
			}

			val = `${formatFileSize(used)} / ${formatFileSize(total)}`;
			val += `<div class="bargraph-h"><div class="fill ${memStatusClass}" style="width: ${memPct}%"></div></div>`;
		}
		else if (field === 'disk') {
			val = `${formatFileSize(totalAvail)} free (${diskPct}% used)`;
		}
		else if (field === 'actions') {
			val = '<div class="">' + actionButtons.join(' ') + '</div>';
		}

		cell.innerHTML = val;
	});

	// Remove loading rows
	table.querySelectorAll('div.host-loading').forEach(row => {
		row.remove();
	});
}

function noHostsAvailable() {
	const body = hostsTable.querySelector('.body'),
		row = document.createElement('div');

	body.innerHTML = '';

	row.className = 'host no-hosts-available';
	row.innerHTML = '<div class="warning-message"><p>No hosts available. Please <a href="/host/add">add a host</a> to manage applications and services.</p></div>';
	body.appendChild(row);
}

/**
 * Load all hosts and their stats
 */
function loadAllHosts() {
	fetchHosts().then(hosts => {
		if (Object.keys(hosts).length === 0) {
			noHostsAvailable();
			return;
		}

		Object.entries(hosts).forEach(([host, hostData]) => {
			populateHostsTable(host, hostData);
		});
	}).catch(error => {
		console.error('Error loading hosts:', error);
		noHostsAvailable();
	});
}

// Dynamic events for various buttons
document.addEventListener('click', e => {
	if (e.target && (e.target.classList.contains('link-control') || e.target.closest('.link-control'))) {
		let btn = e.target.classList.contains('link-control') ? e.target : e.target.closest('.link-control'),
			href = btn.dataset.href;

		e.preventDefault();
		window.location.href = href;
	}
});

// View changer buttons
document.querySelectorAll('.view-changer').forEach(btn => {
	btn.addEventListener('click', () => {
		hostsTable.classList.remove('card-view', 'table-view');
		hostsTable.classList.add(btn.dataset.view);
		localStorage.setItem('hosts-view', btn.dataset.view);
	});
});

// Load on page load
window.addEventListener('DOMContentLoaded', () => {
	// Set initial view from localStorage
	const savedView = localStorage.getItem('hosts-view');
	if (savedView === 'card-view' || savedView === 'table-view') {
		hostsTable.classList.add(savedView);
	} else {
		hostsTable.classList.add('card-view'); // Default view
	}

	// Add resize handler to force UI to card view when less than 1200px wide
	window.addEventListener('resize', () => {
		if (window.innerWidth < 1200 && hostsTable.classList.contains('table-view')) {
			hostsTable.classList.remove('table-view');
			hostsTable.classList.add('card-view');
			hostsTable.dataset.mobileOverride = '1';
		} else if (window.innerWidth >= 1200 && hostsTable.dataset.mobileOverride === '1') {
			hostsTable.classList.remove('card-view');
			hostsTable.classList.add('table-view');
			delete hostsTable.dataset.mobileOverride;
		}
	});
	if (window.innerWidth < 1200 && hostsTable.classList.contains('table-view')) {
		hostsTable.classList.remove('table-view');
		hostsTable.classList.add('card-view');
		hostsTable.dataset.mobileOverride = '1';
	}

	// Load all hosts and periodically update the list
	loadAllHosts();
	setInterval(loadAllHosts, 60*1000); // Refresh hosts every 60 seconds
});

