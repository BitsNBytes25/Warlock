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
	row.className = 'host';
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
			cell.dataset.title = 'CPU: ';
			val = '<span class="value"></span>';
			if (hostData.cpu.model) {
				val += `<div class="cpu-details">${hostData.cpu.model}</div>`;
			}
			val += `<div class="bargraph-h"><div class="fill" style="width: 0%"></div></div>`;
		}
		else if (field === 'memory') {
			cell.dataset.title = 'Memory: ';
			val = `<span class="value"></span> / ${formatFileSize(hostData.memory, 0)}`;
			val += `<div class="bargraph-h"><div class="fill" style="width: 0%"></div></div>`;
		}
		else if (field === 'disk') {
			val = '<span class="value1"></span> <span class="value2"></span>';
			val += `<div class="bargraph-h"><div class="fill" style="width: 0%"></div></div>`;
		}
		else if (field === 'net') {
			cell.dataset.title = 'Net: ';
			val = '<span class="value1"></span> <span class="value2"></span>';
		}
		else if (field.startsWith('advanced-disk-')) {
			let dev= field.replace('advanced-disk-', ''),
				disk = hostData.disks.find(d => d.dev === dev);
			cell.dataset.title = `Disk ${disk.mount}: `;
			cell.className = 'advanced-disk advanced-disk-' + dev.replace(/\//g, '_');
			val = '<span class="value1"></span> <span class="value2"></span>';
			val += `<div class="bargraph-h"><div class="fill" style="width: 0%"></div></div>`;
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

document.addEventListener('hostChange', e => {
	let row = hostsContainer.querySelector(`div[data-host="${e.detail.host}"]`);
	if (!row) {
		return;
	}
	let host = hostData.find(h => h.host === e.detail.host);

	if (e.detail.hasOwnProperty('cpu_usage')) {
		let cell = row.querySelector('.cpu'),
			bar = cell.querySelector('.bargraph-h .fill');

		numberTick(
			cell.querySelector('.value'),
			e.detail.cpu_usage,
			v => v.toFixed(1) + '%',
		);
		progressBarTick(bar, percent);
	}

	if (e.detail.hasOwnProperty('memory_used')) {
		let cell = row.querySelector('.memory'),
			bar = cell.querySelector('.bargraph-h .fill'),
			totalMemory = host.memory,
			percent = (e.detail.memory_used / totalMemory) * 100;

		numberTick(
			cell.querySelector('.value'),
			e.detail.memory_used,
			v => formatFileSize(v, 0),
		);
		progressBarTick(bar, percent);
	}

	if (e.detail.hasOwnProperty('disks_free')) {
		let cell = row.querySelector('.disk'),
			bar = cell.querySelector('.bargraph-h .fill'),
			totalDisk = host.metrics.disks_total,
			percent = (e.detail.disks_used / totalDisk) * 100;

		numberTick(
			cell.querySelector('.value1'),
			e.detail.disks_free,
			v => formatFileSize(v, 1) + ' free',
		);
		progressBarTick(bar, percent);
	}

	// Check advanced disks
	for(let disk of host.disks) {
		if (e.detail.hasOwnProperty(`disk_${disk.dev}_free`)) {
			let cell = row.querySelector('.advanced-disk-' + disk.dev.replace(/\//g, '_')),
				bar = cell.querySelector('.bargraph-h .fill'),
				totalDisk = host.metrics[`disk_${disk.dev}_total`],
				percent = (e.detail[`disk_${disk.dev}_used`] / totalDisk) * 100;

			numberTick(
				cell.querySelector('.value1'),
				e.detail[`disk_${disk.dev}_free`],
				v => formatFileSize(v, 1) + ' free',
			);
			numberTick(
				cell.querySelector('.value2'),
				percent,
				v => '(' + v.toFixed(0) + '% used)',
			);
			progressBarTick(bar, percent);
		}
	}

	if (e.detail.hasOwnProperty('net_tx') || e.detail.hasOwnProperty('net_rx')) {
		let cell = row.querySelector('.net'),
			tx = cell.querySelector('.value1'),
			rx = cell.querySelector('.value2');

		numberTick(tx, host.metrics.net_tx, v => formatBitSpeed(v) + ' ↑');
		numberTick(rx, host.metrics.net_rx, v => '↓ ' + formatBitSpeed(v));
	}
});
