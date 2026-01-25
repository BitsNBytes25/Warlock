const logsContainer = document.getElementById('logsContainer'),
	logsModeHourBtn = document.getElementById('logs-mode-hour'),
	logsModeDayBtn = document.getElementById('logs-mode-day'),
	logsModeLiveBtn = document.getElementById('logs-mode-live'),
	logsPagerPrevBtn = document.getElementById('logs-pager-previous'),
	logsPagerNextBtn = document.getElementById('logs-pager-next');

let serviceLogsMode = 'live',
	serviceLogsOffset = 1,
	req = null;

async function fetchLogs() {
	logsContainer.innerHTML = '';

	if (serviceLogsMode === 'live') {
		req = stream(
			`/api/service/logs/${loadedApplication}/${loadedHost}/${loadedService}`,
			'GET',
			{},
			null,
			(event, data) => {
				terminalOutputHelper(logsContainer, event, data);
			}
		);
	}
	else {
		if (req) {
			req.cancel();
			req = null;
		}

		// Render a header message in the logsContainer for the selected time period and offset
		let headerMessage = ``;
		if (serviceLogsMode === 'h') {
			if (serviceLogsOffset === 1) {
				headerMessage = 'Logs for the past hour';
			}
			else {
				headerMessage = `Hourly logs from ${serviceLogsOffset} hours ago`;
			}
		} else if (serviceLogsMode === 'd') {
			if (serviceLogsOffset === 1) {
				headerMessage = 'Logs for the past day';
			}
			else {
				headerMessage = `Daily logs from ${serviceLogsOffset} days ago`;
			}
		}

		const headerEntry = document.createElement('div');
		headerEntry.textContent = headerMessage;
		headerEntry.className = 'line-stdout log-header';
		logsContainer.appendChild(headerEntry);

		fetch(`/api/service/logs/${loadedApplication}/${loadedHost}/${loadedService}?mode=${serviceLogsMode}&offset=${serviceLogsOffset}`, {
			method: 'GET',
		})
			.then(response => response.text())
			.then(result => {
				if (result.trim() === '') {
					const logEntry = document.createElement('div');
					logEntry.textContent = 'No logs available for the selected time period.';
					logEntry.className = 'line-stderr';
					logsContainer.appendChild(logEntry);
					return;
				}
				let lines = result.split('\n');
				lines.forEach(line => {
					const logEntry = document.createElement('div');
					logEntry.textContent = line;
					logEntry.className = 'line-stdout';
					logsContainer.appendChild(logEntry);
				});
			})
			.catch(e => {
				const logEntry = document.createElement('div');
				logEntry.textContent = `Error fetching logs: ${e.message}`;
				logEntry.className = 'line-stderr';
				logsContainer.appendChild(logEntry);
			});
	}
}

function closeLogs() {
	if (req) {
		req.cancel();
		req = null;
	}

	logsContainer.innerHTML = '';
}

// Events for this UI
logsModeLiveBtn.addEventListener('click', event => {
	event.preventDefault();
	if (serviceLogsMode !== 'live') {
		serviceLogsMode = 'live';
		serviceLogsOffset = 1;
		logsContainer.innerHTML = '';
		logsModeLiveBtn.classList.add('active');
		logsModeHourBtn.classList.remove('active');
		logsModeDayBtn.classList.remove('active');
		logsPagerPrevBtn.classList.add('disabled');
		logsPagerNextBtn.classList.add('disabled');
		fetchLogs();
	}
});
logsModeHourBtn.addEventListener('click', event => {
	event.preventDefault();
	if (serviceLogsMode !== 'h') {
		serviceLogsMode = 'h';
		serviceLogsOffset = 1;
		logsContainer.innerHTML = '';
		logsModeHourBtn.classList.add('active');
		logsModeLiveBtn.classList.remove('active');
		logsModeDayBtn.classList.remove('active');
		logsPagerPrevBtn.classList.remove('disabled');
		fetchLogs();
	}
});
logsModeDayBtn.addEventListener('click', event => {
	event.preventDefault();
	if (serviceLogsMode !== 'd') {
		serviceLogsMode = 'd';
		serviceLogsOffset = 1;
		logsContainer.innerHTML = '';
		logsModeDayBtn.classList.add('active');
		logsModeLiveBtn.classList.remove('active');
		logsModeHourBtn.classList.remove('active');
		logsPagerPrevBtn.classList.remove('disabled');
		fetchLogs();
	}
});
logsPagerPrevBtn.addEventListener('click', event => {
	event.preventDefault();
	if (!logsPagerPrevBtn.classList.contains('disabled')) {
		serviceLogsOffset += 1;
		logsContainer.innerHTML = '';
		logsPagerNextBtn.classList.remove('disabled');
		fetchLogs();
	}
});
logsPagerNextBtn.addEventListener('click', event => {
	event.preventDefault();
	if (!logsPagerNextBtn.classList.contains('disabled') && serviceLogsOffset > 1) {
		serviceLogsOffset -= 1;
		logsContainer.innerHTML = '';
		if (serviceLogsOffset === 1) {
			logsPagerNextBtn.classList.add('disabled');
		}
		fetchLogs();
	}
});