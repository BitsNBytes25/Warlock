// Example: populate one host entry from a JS object
function renderHost(host, hostData) {
	const hostContainer = document.createElement('div'),
		hostnameContainer = document.createElement('div'),
		metricsContainer = document.createElement('div');

	hostContainer.className = 'host-card';
	hostContainer.dataset.host = host;
	metricsContainer.className = 'host-metrics';

	const target = document.getElementById('hostsList');
	const cpuGraph = document.getElementById('cpu-speedometer-template').content.cloneNode(true);

	const thumbnail = document.createElement('img');
	thumbnail.className = 'os-thumbnail';
	if (hostData.os.name && hostData.os.version) {
		thumbnail.src = `/media/wallpapers/servers/${hostData.os.name.toLowerCase()}_${hostData.os.version.toLowerCase()}.webp`;
		thumbnail.dataset.fallback = '/media/wallpapers/servers/generic.webp';
		thumbnail.alt = hostData.os.name;
		thumbnail.onerror = "this.onerror=null;this.src=this.dataset.fallback;";
	}
	else {
		thumbnail.src = '/media/wallpapers/servers/generic.webp';
	}

	// Hostname
	hostnameContainer.className = 'host-title';
	if (hostData.os.title) {
		const os = document.createElement('div');
		os.className = 'host-icon';
		os.innerHTML = renderHostIcon(host);
		hostnameContainer.appendChild(os);
	}
	const hostname = document.createElement('h4');
	hostname.className = 'host-name';
	hostname.textContent = hostData.hostname || 'Unknown';
	hostnameContainer.appendChild(hostname);

	// IP
	const ip = document.createElement('div');
	ip.className = 'host-desc';
	ip.textContent = host || '';
	hostnameContainer.appendChild(ip);

	// Actions (Add Delete button)
	const actions = document.createElement('div');
	actions.className = 'host-actions';
	const deleteBtn = document.createElement('button');
	deleteBtn.className = 'link-control action-remove';
	deleteBtn.dataset.href = `/host/delete/${encodeURIComponent(host)}`;
	deleteBtn.title = 'Delete Host';
	deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
	actions.appendChild(deleteBtn);
	hostnameContainer.appendChild(actions);

	// CPU
	const cpu = document.createElement('div');
	cpu.className = 'metric-item metric-cpu';
	cpu.appendChild(cpuGraph);
	const cpuModel = document.createElement('div');
	cpuModel.className = 'metric-label';
	if (hostData.cpu.model) {
		cpuModel.textContent = (hostData.cpu.count > 1 ? `${hostData.cpu.count}x ` : '') + hostData.cpu.model;
		cpu.appendChild(cpuModel);
	}
	metricsContainer.appendChild(cpu);

	// Adjust CPU needle
	const percent = Math.max(0, Math.min(100, Number(hostData.cpu.usage) || 0));
	// Rotate needle: map 0-100% to -90deg..90deg (semicircle)
	const needle = cpu.querySelector('.gauge-needle');
	// Calculate rotation
	const rot = -90 + (percent * 180 / 100);
	// Apply transform
	needle.style.transform = `rotate(${rot}deg)`;

	// Adjust CPU bar
	// Colour the arc by adjusting stroke-dashoffset proportional to percent
	const arc = cpu.querySelector('.gauge-arc');
	if (arc) {
		// stroke-dasharray set in template ~565 (half circle circumference). Adjust offset.
		const offset = 565 - (255 * (percent / 100));
		arc.style.strokeDashoffset = String(offset);
	}

	// Memory
	const memory = document.createElement('div');
	memory.className = 'metric-item metric-memory';
	const memGraph = document.createElement('div');
	memGraph.className = 'mem-graph metric-graph';
	const memUsed = document.createElement('div');
	memUsed.className = 'mem-used';
	memGraph.appendChild(memUsed);
	memory.appendChild(memGraph);
	const memLabel = document.createElement('div');
	memLabel.className = 'metric-label';
	memLabel.textContent = `${formatFileSize(hostData.memory.used)} / ${formatFileSize(hostData.memory.total)}`;
	memory.appendChild(memLabel);
	metricsContainer.appendChild(memory);

	// Memory values
	const used = Number(hostData.memory.used || 0);
	const total = Number(hostData.memory.total || 0) || 1;
	const memPct = Math.max(0, Math.min(100, (used / total) * 100));
	if (memPct >= 80) {
		memGraph.classList.add('usage-status-critical');
	}
	else if (memPct >= 60) {
		memGraph.classList.add('usage-status-warning');
	}
	else {
		memGraph.classList.add('usage-status-normal');
	}
	memUsed.style.height = `${memPct}%`;

	hostContainer.appendChild(thumbnail);
	hostContainer.appendChild(hostnameContainer);
	hostContainer.appendChild(metricsContainer);
	target.appendChild(hostContainer);
}

/**
 * Updating an existing host entry with new metrics
 *
 * @param {string} host
 * @param {HostData} hostData
 */
function updateHost(host, hostData) {
	const hostContainer = document.querySelector(`.host-card[data-host="${host}"]`);
	if (!hostContainer) {
		// Host not found, render new
		renderHost(host, hostData);
		return;
	}

	// TEST
	//hostData.cpu.usage = 95;

	// Update CPU
	const cpuNeedle = hostContainer.querySelector('.gauge-needle');
	const percent = Math.max(0, Math.min(100, Number(hostData.cpu.usage) || 0));
	const rot = -90 + (percent * 180 / 100);
	cpuNeedle.style.transform = `rotate(${rot}deg)`;

	const arc = hostContainer.querySelector('.gauge-arc');
	if (arc) {
		const offset = 565 - (255 * (percent / 100));
		arc.style.strokeDashoffset = String(offset);
	}

	// Update Memory
	const memUsedDiv = hostContainer.querySelector('.mem-used');
	const memGraph = hostContainer.querySelector('.mem-graph');
	const used = Number(hostData.memory.used || 0);
	const total = Number(hostData.memory.total || 0) || 1;
	const memPct = Math.max(0, Math.min(100, (used / total) * 100));
	memUsedDiv.style.height = `${memPct}%`;

	// Update memory status class
	memGraph.classList.remove('usage-status-normal', 'usage-status-warning', 'usage-status-critical');
	if (memPct >= 80) {
		memGraph.classList.add('usage-status-critical');
	}
	else if (memPct >= 60) {
		memGraph.classList.add('usage-status-warning');
	}
	else {
		memGraph.classList.add('usage-status-normal');
	}

	// Update memory label
	const memLabel = hostContainer.querySelector('.metric-memory .metric-label');
	memLabel.textContent = `${formatFileSize(hostData.memory.used)} / ${formatFileSize(hostData.memory.total)}`;
}

// Example usage: replace loading state and render array
function renderHosts(hosts) {
	const container = document.getElementById('hostsList');

	if (Object.keys(hosts).length === 0) {
		container.innerHTML = '<div style="grid-column:1/-1;"><p class="error-message">No hosts found</p></div>';
		return;
	}

	Object.keys(hosts).forEach(hostId => {
		if (document.querySelector(`.host-card[data-host="${hostId}"]`)) {
			updateHost(hostId, hosts[hostId]);
		}
		else {
			renderHost(hostId, hosts[hostId]);
		}
	});
}

function displayNoHosts() {
	const hostsList = document.getElementById('hostsList');
	hostsList.innerHTML = `
		<div style="grid-column: 1 / -1;">
			<div class="error-message">
				<p style="text-align:center; width:100%;">
					<i class="fas fa-server" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
					<br/>
					No hosts available. Please <a href="/host/add">add a host</a> to manage applications and services.
				</p>
			</div>
		</div>
	`;
}

fetchHosts().then(hosts => {
	if (Object.values(hosts).length === 0) {
		displayNoHosts();
		return;
	}

	setInterval(() => {
		fetchHosts().then(hosts => renderHosts(hosts));
	}, 5000);

	renderHosts(hosts);
}).catch(err => {
	console.error('Error fetching hosts:', err);
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