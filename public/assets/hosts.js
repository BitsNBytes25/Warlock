const hostsContainer = document.getElementById('hostsContainer'),
	hostsTable = document.getElementById('hosts-table');

/**
 * Populate hosts table with host data
 * @param {HostData} hostData
 */
function populateHostsTable(hostData) {
	const table = hostsTable;

	let row,
		fields = ['thumbnail', 'hostname', 'ip', 'os', 'cpu', 'memory', 'disk', 'net', 'actions'];

	// Create a field for each disk; these get displayed in the card view.
	for(let disk of hostData.disks) {
		fields.push('advanced-disk-' + disk.dev);
	}

	// Create new row
	row = document.createElement('div');
	row.className = 'host-entry';
	row.setAttribute('data-host', hostData.host);
	table.querySelector('.body').appendChild(row);

	// Initialize default cells
	fields.forEach(field => {
		const cell = document.createElement('div');
		cell.className = field;
		let val = '';

		if (field === 'thumbnail') {
			val = renderHostOSThumbnail(hostData.host).outerHTML;
		}
		else if (field === 'hostname') {
			val = `${renderHostIcon(hostData.host)} <span>${hostData.hostname}</span>`;
		}
		else if (field === 'actions') {
			val = `<div class=""><button title="Host Details" data-href="/host/details/${encodeURIComponent(hostData.host)}" class="link-control action-view">
				<i class="fas fa-info-circle"></i><span>Details</span>
			</button></div>`
		}
		else if (field === 'ip') {
			// If the user typed in a hostname for the host, (completely valid), use the public_ip instead.
			if (!hostData.host.match(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/)) {
				val = hostData.public_ip;
			}
			else {
				val = hostData.host;
			}
		}
		else if (field === 'os') {
			val = hostData.os ? hostData.os.title : 'Unknown';
		}
		else if (field === 'cpu') {
			val = `<host-cpu-metric host=${hostData.host} model=1 bargraph=1 data-title="CPU: "></host-cpu-metric>`;
		}
		else if (field === 'memory') {
			val = `<host-memory-metric host=${hostData.host} bargraph=1 data-title="MEM: "></host-memory-metric>`;
		}
		else if (field === 'disk') {
			val = `<host-disks-metric host=${hostData.host} bargraph=1 data-title="DISK: "></host-disks-metric>`;
		}
		else if (field === 'net') {
			val = `<host-network-metric host=${hostData.host} data-title="NET: "></host-network-metric>`;
		}
		else if (field.startsWith('advanced-disk-')) {
			let dev= field.replace('advanced-disk-', ''),
				disk = hostData.disks.find(d => d.dev === dev);
			cell.className = 'advanced-disk';
			val = `<host-disk-metric host=${hostData.host} dev=${dev} bargraph=1 data-title="DISK ${disk.mount}: "></host-disk-metric>`;
		}

		cell.innerHTML = val;
		row.appendChild(cell);
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
	if (hostData.length === 0) {
		noHostsAvailable();
		return;
	}

	for(let host of hostData) {
		populateHostsTable(host);
	}

	// Start the poll to retrieve live stats
	pollHostsMetrics();
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
});
