let metricsRefreshInterval = null;


async function loadMetrics() {
	const host = loadedHost || null,
		service = loadedService || null;

	if (!host || !service) {
		console.error('Host or service not specified for loading metrics');
		return;
	}

	try {
		const timeframe = document.querySelector('.timeframe-btn.active')?.dataset.timeframe || 'hour';
		const response = await fetch(`/api/metrics/${host}/${service}?timeframe=${timeframe}`);
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
		player_count: [],
		status: [],
		response_time: []
	};

	metrics.forEach(metric => {
		groupedMetrics['cpu_usage'].push({
			timestamp: metric.interval_start * 1000, // Convert to milliseconds
			value: metric.avg_cpu_usage
		});
		groupedMetrics['memory_usage'].push({
			timestamp: metric.interval_start * 1000,
			value: metric.avg_memory_usage
		});
		groupedMetrics['player_count'].push({
			timestamp: metric.interval_start * 1000,
			value: metric.avg_player_count
		});
		groupedMetrics['status'].push({
			timestamp: metric.interval_start * 1000,
			value: metric.avg_status
		});
		groupedMetrics['response_time'].push({
			timestamp: metric.interval_start * 1000,
			value: metric.avg_response_time
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
				data: groupedMetrics.cpu_usage.map(m => ({x: m.timestamp, y: m.value})),
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
				label: 'Memory MB',
				data: groupedMetrics.memory_usage.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#00d4aa',
				backgroundColor: 'rgba(0, 212, 170, 0.1)',
				fill: true,
				tension: 0.4
			}]
		},
		options: commonOptions
	});

	// Players Chart
	metricsCharts.players = new Chart(document.getElementById('playersChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Players',
				data: groupedMetrics.player_count.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#ff6b6b',
				backgroundColor: 'rgba(255, 107, 107, 0.1)',
				fill: true,
				tension: 0.4,
				stepped: true
			}]
		},
		options: {
			...commonOptions,
			scales: {
				...commonOptions.scales,
				y: {
					...commonOptions.scales.y,
					ticks: {
						...commonOptions.scales.y.ticks,
						stepSize: 1
					}
				}
			}
		}
	});

	// Status Chart (1 = running, 0 = stopped)
	metricsCharts.status = new Chart(document.getElementById('statusChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Status',
				data: groupedMetrics.status.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#ffd93d',
				backgroundColor: 'rgba(255, 217, 61, 0.1)',
				fill: true,
				stepped: true
			}]
		},
		options: {
			...commonOptions,
			scales: {
				...commonOptions.scales,
				y: {
					...commonOptions.scales.y,
					min: 0,
					max: 1,
					ticks: {
						...commonOptions.scales.y.ticks,
						stepSize: 1,
						callback: function(value) {
							return value === 1 ? 'Running' : 'Stopped';
						}
					}
				}
			}
		}
	});

	// Response Time Chart
	metricsCharts.responseTime = new Chart(document.getElementById('responseTimeChart'), {
		type: 'line',
		data: {
			datasets: [{
				label: 'Response Time (ms)',
				data: groupedMetrics.response_time.map(m => ({x: m.timestamp, y: m.value})),
				borderColor: '#c44569',
				backgroundColor: 'rgba(196, 69, 105, 0.1)',
				fill: true,
				tension: 0.4
			}]
		},
		options: commonOptions
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