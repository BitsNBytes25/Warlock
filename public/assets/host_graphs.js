let metricsRefreshInterval = null;


async function loadMetrics() {
	const host = loadedHost || null;

	if (!host) {
		console.error('Host not specified for loading metrics');
		return;
	}

	try {
		const timeframe = document.querySelector('.timeframe-btn.active')?.dataset.timeframe || 'hour';
		const response = await fetch(`/api/metrics/${host}?timeframe=${timeframe}`);
		const result = await response.json();

		if (!result.success) {
			console.error('Error loading metrics:', result.error);
			return;
		}

		renderCharts(result.data, timeframe);

		if (!metricsRefreshInterval) {
			metricsRefreshInterval = setInterval(() => {
				loadMetrics();
			}, 1000 * 60);
		}
	} catch (error) {
		console.error('Error fetching metrics:', error);
	}
}

function closeMetrics() {
	if (metricsRefreshInterval) {
		clearInterval(metricsRefreshInterval);
		metricsRefreshInterval = null;
	}
}

function renderCharts(metrics, timeframe) {
	// Group metrics by type
	const groupedMetrics = {
		cpu_usage: [],
		memory_usage: [],
		disk_usage: [],
		network_rx: [],
		network_tx: [],
	};

	metrics.forEach(metric => {
		groupedMetrics['cpu_usage'].push({
			x: metric.timestamp * 1000, // Convert to milliseconds
			y: metric.cpu
		});
		groupedMetrics['memory_usage'].push({
			x: metric.timestamp * 1000,
			y: Math.round(metric.memory * 100 / (1024 * 1024 * 1024)) / 100 // Convert to GB
		});
		groupedMetrics['disk_usage'].push({
			x: metric.timestamp * 1000,
			y: Math.round(metric.disk * 10 / (1024 * 1024 * 1024)) / 10 // Convert to GB
		});
		groupedMetrics['network_rx'].push({
			x: metric.timestamp * 1000,
			y: parseInt(metric.rx * 8 / 1024)
		});
		groupedMetrics['network_tx'].push({
			x: metric.timestamp * 1000,
			y: parseInt(metric.tx * 8 / 1024)
		});
	});

	// Destroy existing charts
	Object.values(metricsCharts).forEach(chart => {
		if (chart) chart.destroy();
	});

	// Common chart options
	const commonOptions = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: false
			},
			tooltip: {
				backgroundColor: 'rgba(0, 0, 0, 0.8)',
				titleColor: '#fff',
				bodyColor: '#fff',
				borderColor: '#0096ff',
				borderWidth: 1
			}
		},
		scales: {
			x: {
				type: 'time',
				time: {
					unit: getTimeUnit(timeframe)
				},
				grid: {
					color: 'rgba(255, 255, 255, 0.1)'
				},
				ticks: {
					color: '#fff',
					font: {
						size: 11
					}
				},
				title: {
					color: '#fff'
				}
			},
			y: {
				grid: {
					color: 'rgba(255, 255, 255, 0.1)'
				},
				ticks: {
					color: '#fff',
					font: {
						size: 11
					}
				},
				title: {
					color: '#fff'
				}
			}
		}
	};

	// CPU Chart
	metricsCharts.cpu = new Chart(document.getElementById('cpuChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'CPU %',
				data: groupedMetrics.cpu_usage,
				borderColor: '#0096ff',
				backgroundColor: 'rgba(0, 150, 255, 0.1)',
				fill: true,
				tension: 0.4
			}]
		},
		options: commonOptions
	});

	// Memory Chart
	metricsCharts.memory = new Chart(document.getElementById('memoryChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Memory (GB)',
				data: groupedMetrics.memory_usage,
				borderColor: '#00d4aa',
				backgroundColor: 'rgba(0, 212, 170, 0.1)',
				fill: true,
				tension: 0.4
			}]
		},
		options: commonOptions
	});

	// Players Chart
	metricsCharts.disk = new Chart(document.getElementById('diskChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Disk Usage (GB)',
				data: groupedMetrics.disk_usage,
				borderColor: '#ff6b6b',
				backgroundColor: 'rgba(255, 107, 107, 0.1)',
				fill: true,
				tension: 0.4,
				stepped: true
			}]
		},
		options: commonOptions
	});

	metricsCharts.network = new Chart(document.getElementById('networkChart'), {
		type: 'line',
		data: {
			datasets: [
				{
					label: 'RX (Kbps)',
					data: groupedMetrics.network_rx,
					borderColor: '#ffb800',
					backgroundColor: 'rgba(255,184,0,0.5)',
					fill: true,
					stepped: true
				},
				{
					label: 'TX (Kbps)',
					data: groupedMetrics.network_tx,
					borderColor: '#00d4aa',
					backgroundColor: 'rgba(0,212,170,0.5)',
					fill: true,
					stepped: true
				}
			]
		},
		options: {
			...commonOptions,
			stacked: true,
		}
	});
}

function getTimeUnit(timeframe) {
	switch(timeframe) {
		case 'hour':
			return 'minute';
		case 'today':
		case 'day':
		case 'week':
			return 'hour';
		case 'month':
		case '3month':
			return 'day';
		case '6month':
		case 'year':
			return 'week';
		default:
			return 'hour';
	}
}

// Add events to timeframe buttons
document.querySelectorAll('.timeframe-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		loadMetrics();
	});
});