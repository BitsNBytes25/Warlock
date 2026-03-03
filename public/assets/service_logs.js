const logsContainer = document.getElementById('logsContainer'),
	logsModeHourBtn = document.getElementById('logs-mode-hour'),
	logsModeDayBtn = document.getElementById('logs-mode-day'),
	logsModeLiveBtn = document.getElementById('logs-mode-live'),
	logsPagerPrevBtn = document.getElementById('logs-pager-previous'),
	logsPagerNextBtn = document.getElementById('logs-pager-next'),
	commandInputSection = document.getElementById('commandInputSection'),
	commandInput = document.getElementById('commandInput'),
	commandSendBtn = document.getElementById('commandSendBtn'),
	autocompleteDropdown = document.getElementById('autocompleteDropdown'),
	autocompleteSuggestions = document.getElementById('autocompleteSuggestions');

let serviceLogsMode = 'live',
	serviceLogsOffset = 1,
	req = null,
	commandHistory = [],
	currentHistoryIndex = -1,
	availableCommands = null,
	autocompleteIndex = -1;

function updateCommandInputUI() {
	const hasCmd = checkHostAppHasOption(loadedApplication, loadedHost, 'cmd'),
		isLiveMode = serviceLogsMode === 'live',
		isRunning = commandInput.dataset.running === '1';

	if (hasCmd && isLiveMode && isRunning) {
		commandInputSection.style.display = 'block';
		commandInput.disabled = false;
		commandSendBtn.disabled = false;
		commandSendBtn.classList.remove('disabled');
		commandInput.placeholder = 'Enter command to send to service...';
	} else {
		commandInputSection.style.display = isLiveMode ? 'block' : 'none';
		commandInput.disabled = true;
		commandSendBtn.disabled = true;
		commandSendBtn.classList.add('disabled');

		if (!hasCmd) {
			commandInput.placeholder = 'Game does not support commands';
		}
		else if (!isRunning) {
			commandInput.placeholder = 'Service is not running, cannot run commands';
		}
		else {
			commandInput.placeholder = 'Live commands not available';
		}
	}
}

async function sendCommand() {
	const cmdText = commandInput.value.trim();
	if (!cmdText) return;

	commandInput.value = '';
	commandInput.disabled = true;
	commandSendBtn.disabled = true;

	// Keep a history of this command for arrow key navigation
	commandHistory.push(cmdText);
	currentHistoryIndex = commandHistory.length; // Set to end of history

	try {
		const response = await fetch(`/api/service/cmd/${loadedApplication}/${loadedHost}/${loadedService}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ command: cmdText })
		});

		const data = await response.json();
		if (!data.success) {
			showToast('error', `Command execution failed: ${data.error}`);
		}
	} catch (e) {
		showToast('error', `Error sending command: ${e.message}`);
	}

	commandInput.disabled = false;
	commandSendBtn.disabled = false;
	commandInput.focus();
}

function fetchAvailableCommands() {
	return new Promise(resolve => {
		if (commandInput.dataset.running === '0') {
			// Service not running, don't even try to pull commands.
			resolve([]);
		}

		if (availableCommands !== null) {
			resolve(availableCommands);
		}

		fetch(`/api/service/cmd/${loadedApplication}/${loadedHost}/${loadedService}`, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		})
			.then(response => response.json())
			.then(data => {
				if (data.success && Array.isArray(data.commands)) {
					// Commands should be sorted alphabetically for better UX
					data.commands.sort((a, b) => a.localeCompare(b));
					availableCommands = data.commands;
					resolve(availableCommands);
				}
				else {
					console.warn('Failed to fetch available commands:', data.error || 'Unknown error');
					resolve([]);
				}
			})
			.catch(e => {
				console.warn('Failed to fetch available commands:', e.message);
				availableCommands = [];
				resolve(availableCommands);
			});
	});
}

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
		updateCommandInputUI();
		await fetchAvailableCommands();
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
		updateCommandInputUI();
	}
}

function closeLogs() {
	if (req) {
		req.cancel();
		req = null;
	}

	logsContainer.innerHTML = '';
}

function hideAutocomplete() {
	autocompleteDropdown.style.display = 'none';
	autocompleteSuggestions.innerHTML = '';
	autocompleteIndex = -1;
}

function filterAndDisplayAutocomplete(inputValue) {
	if (!inputValue.trim() || !availableCommands || availableCommands.length === 0) {
		hideAutocomplete();
		return;
	}

	const filtered = availableCommands.filter(cmd =>
		cmd.toLowerCase().startsWith(inputValue.toLowerCase())
	);

	if (filtered.length === 0) {
		hideAutocomplete();
		return;
	}

	autocompleteSuggestions.innerHTML = '';
	filtered.forEach(cmd => {
		const li = document.createElement('li');
		li.textContent = cmd;
		li.addEventListener('click', () => {
			commandInput.value = cmd;
			hideAutocomplete();
			commandInput.focus();
		});
		autocompleteSuggestions.appendChild(li);
	});

	autocompleteDropdown.style.display = 'block';
	autocompleteIndex = -1;
}

function setAutocompleteActive(index) {
	const items = autocompleteSuggestions.querySelectorAll('li');
	items.forEach(item => item.classList.remove('active'));

	if (index >= 0 && index < items.length) {
		items[index].classList.add('active');
		autocompleteIndex = index;
	} else {
		autocompleteIndex = -1;
	}
}

function selectCurrentAutocomplete() {
	const items = autocompleteSuggestions.querySelectorAll('li');
	if (autocompleteIndex >= 0 && autocompleteIndex < items.length) {
		commandInput.value = items[autocompleteIndex].textContent;
		hideAutocomplete();
		return true;
	}
	return false;
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

// Command input event listeners
commandSendBtn.addEventListener('click', sendCommand);

commandInput.addEventListener('input', async event => {
	await fetchAvailableCommands();
	if (event.target.value.length >= 2) {
		filterAndDisplayAutocomplete(event.target.value);
	}
	else {
		filterAndDisplayAutocomplete('');
	}
});

commandInput.addEventListener('keydown', event => {
	const dropdownVisible = autocompleteDropdown.style.display === 'block';
	const items = autocompleteSuggestions.querySelectorAll('li');
	const itemCount = items.length;

	if (event.key === 'Enter') {
		if (dropdownVisible && autocompleteIndex >= 0) {
			event.preventDefault();
			selectCurrentAutocomplete();
			commandInput.focus();
		} else if (!commandSendBtn.disabled) {
			event.preventDefault();
			sendCommand();
		}
	}
	else if (event.key === 'Tab') {
		if (dropdownVisible && itemCount > 0) {
			event.preventDefault();
			if (autocompleteIndex === -1) {
				setAutocompleteActive(0);
			} else if (autocompleteIndex < itemCount - 1) {
				setAutocompleteActive(autocompleteIndex + 1);
			} else {
				selectCurrentAutocomplete();
			}
		}
	}
	else if (event.key === 'Escape') {
		if (dropdownVisible) {
			event.preventDefault();
			hideAutocomplete();
		}
	}
});

commandInput.addEventListener('keyup', event => {
	const dropdownVisible = autocompleteDropdown.style.display === 'block';
	const items = autocompleteSuggestions.querySelectorAll('li');
	const itemCount = items.length;

	if (event.key === 'ArrowUp') {
		event.preventDefault();
		if (dropdownVisible && itemCount > 0) {
			// Navigate autocomplete
			if (autocompleteIndex <= 0) {
				setAutocompleteActive(itemCount - 1);
			} else {
				setAutocompleteActive(autocompleteIndex - 1);
			}
		} else {
			// Navigate command history
			if (currentHistoryIndex > 0) {
				currentHistoryIndex -= 1;
				commandInput.value = commandHistory[currentHistoryIndex];
			}
		}
	}
	else if (event.key === 'ArrowDown') {
		event.preventDefault();
		if (dropdownVisible && itemCount > 0) {
			// Navigate autocomplete
			if (autocompleteIndex < itemCount - 1) {
				setAutocompleteActive(autocompleteIndex + 1);
			} else {
				setAutocompleteActive(0);
			}
		} else {
			// Navigate command history
			if (currentHistoryIndex < commandHistory.length - 1) {
				currentHistoryIndex += 1;
				commandInput.value = commandHistory[currentHistoryIndex];
			} else {
				currentHistoryIndex = commandHistory.length;
				commandInput.value = '';
			}
		}
	}
});

document.addEventListener('serviceStatusChange', e => {
	if (e.detail.value === 'running') {
		commandInput.dataset.running = '1';
	}
	else {
		commandInput.dataset.running = '0';
	}

	updateCommandInputUI();
});
