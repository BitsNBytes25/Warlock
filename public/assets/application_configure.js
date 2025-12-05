const autoUpdateModal = document.getElementById('autoUpdateModal'),
	configureAutoUpdateBtn = document.getElementById('configureAutoUpdateBtn'),
	automatedUpdatesDisabledMessage = document.getElementById('automatedUpdatesDisabledMessage'),
	automatedUpdatesEnabledMessage = document.getElementById('automatedUpdatesEnabledMessage'),
	saveAutoUpdateBtn = document.getElementById('saveAutoUpdateBtn'),
	autoRestartModal = document.getElementById('autoRestartModal'),
	configureAutoRestartBtn = document.getElementById('configureAutoRestartBtn'),
	automatedRestartsDisabledMessage = document.getElementById('automatedRestartsDisabledMessage'),
	automatedRestartsEnabledMessage = document.getElementById('automatedRestartsEnabledMessage'),
	saveAutoRestartBtn = document.getElementById('saveAutoRestartBtn'),
	openUpdateBtn = document.getElementById('openUpdateBtn'),
	updateModal = document.getElementById('updateModal'),
	confirmUpdateBtn = document.getElementById('confirmUpdateBtn');

/**
 * Build the HTML for configuration options received from the server
 *
 * Populates to the container with the ID configurationContainer on the main page
 *
 * @param {string} app_guid
 * @param {string} host
 * @param {AppConfigOption[]} options
 */
function buildOptionsForm(app_guid, host, options) {
	let target = document.getElementById('configurationContainer');

	if (options.length === 0) {
		target.innerHTML = '<div class="alert warning-message" role="alert">No configuration options available for this service.</div>';
		return;
	}

	options.forEach(option => {
		let formGroup = document.createElement('div');
		formGroup.className = 'form-group';

		let label = document.createElement('label');
		label.htmlFor = `config-${option.option}`;
		label.className = 'form-label';
		label.innerText = option.option;

		let help = null;
		if (option.help) {
			help = document.createElement('p');
			help.className = 'help-text';
			help.innerText = option.help;
		}

		// Support for configs with a list of options instead of freeform input
		if ('options' in option && Array.isArray(option.options) && option.options.length > 0) {
			option.type = 'select';
		}

		let input;
		switch (option.type) {
			case 'select':
				input = document.createElement('select');
				input.className = 'form-select';
				input.id = `config-${option.option}`;
				option.options.forEach(opt => {
					let optElement = document.createElement('option');
					optElement.value = opt;
					optElement.text = opt;
					if (opt === option.value) {
						optElement.selected = true;
					}
					input.appendChild(optElement);
				});
				break;
			case 'bool':
				input = document.createElement('input');
				input.type = 'checkbox';
				input.className = 'form-check-input';
				input.id = `config-${option.option}`;
				input.checked = option.value === true || option.value === 'true';
				break;
			case 'int':
			case 'float':
				input = document.createElement('input');
				input.type = 'number';
				input.className = 'form-control';
				input.id = `config-${option.option}`;
				input.value = option.value;
				break;
			case 'text':
				input = document.createElement('textarea');
				input.className = 'form-control';
				input.id = `config-${option.option}`;
				input.value = option.value;
				break;
			case 'str':
			default:
				input = document.createElement('input');
				input.type = 'text';
				input.className = 'form-control';
				input.id = `config-${option.option}`;
				input.value = option.value;
				break;
		}

		formGroup.appendChild(label);
		if (help) {
			formGroup.appendChild(help);
		}
		formGroup.appendChild(input);
		target.appendChild(formGroup);

		// Add event handler on input to live-save changes to the backend
		input.addEventListener('change', (event) => {
			let newValue;
			if (option.type === 'bool') {
				newValue = event.target.checked;
			} else if (option.type === 'int') {
				newValue = parseInt(event.target.value, 10);
			} else if (option.type === 'float') {
				newValue = parseFloat(event.target.value);
			} else {
				newValue = event.target.value;
			}

			// Send update to backend
			fetch(`/api/application/configs/${app_guid}/${host}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ [option.option]: newValue })
			})
				.then(response => response.json())
				.then(result => {
					if (result.success) {
						showToast('success', `Configuration option ${option.option} updated successfully.`);
					} else {
						showToast('error', `Failed to update configuration option ${option.option}: ${result.error}`);
					}
				});
		});
	});
}

async function loadAutomaticUpdates() {
	if (!loadedHost) {
		return;
	}
	const identifier = `${loadedApplication}_update`;

	loadCronJob(loadedHost, identifier, autoUpdateModal).then(job => {
		if (job) {
			automatedUpdatesDisabledMessage.style.display = 'none';
			automatedUpdatesEnabledMessage.style.display = 'flex';
		}
		else {
			automatedUpdatesDisabledMessage.style.display = 'flex';
			automatedUpdatesEnabledMessage.style.display = 'none';
		}
	}).catch(e => {
		console.error('Error loading cron job:', e);
		showToast('error', 'Error loading automatic update configuration.');
	})
}

async function loadAutomaticRestarts() {
	if (!loadedHost) {
		return;
	}
	const identifier = `${loadedApplication}_restart`;

	loadCronJob(loadedHost, identifier, autoRestartModal).then(job => {
		if (job) {
			automatedRestartsDisabledMessage.style.display = 'none';
			automatedRestartsEnabledMessage.style.display = 'flex';
		}
		else {
			automatedRestartsDisabledMessage.style.display = 'flex';
			automatedRestartsEnabledMessage.style.display = 'none';
		}
	}).catch(e => {
		console.error('Error loading cron job:', e);
		showToast('error', 'Error loading automatic restart configuration.');
	})
}

async function saveAutomaticUpdates() {
	const guid = loadedApplication;
	const identifier = `${loadedApplication}_update`;
	const gameDir = (applicationData[guid] && applicationData[guid].hosts && applicationData[guid].hosts.filter(h => h.host === loadedHost)[0]) ? applicationData[guid].hosts.filter(h => h.host === loadedHost)[0].path : null;

	if (!gameDir) {
		showToast('error', 'Cannot determine game directory for this host.');
		return;
	}

	const schedule = parseCronSchedule(autoUpdateModal);

	if (schedule === 'DISABLED') {
		// Delete existing identifier
		fetch(`/api/cron/${loadedHost}`, {
			method: 'DELETE',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({identifier})
		})
			.then(r => r.json())
			.then(response => {
				if (response.success) {
					showToast('success', 'Automatic updates disabled.');
					autoUpdateModal.classList.remove('show');
					loadAutomaticUpdates();
				} else {
					showToast('error', `Failed to disable automatic updates: ${response.error}`);
				}
			})
			.catch(() => showToast('error', 'Error disabling automatic updates'));
		return;
	}

	// Build command
	const command = `${gameDir}/manage.py --check-updates && ${gameDir}/manage.py --update`;

	fetch(`/api/cron/${loadedHost}`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({schedule, command, identifier})
	})
		.then(r => r.json())
		.then(response => {
			if (response.success) {
				showToast('success', 'Automatic updates scheduled.');
				autoUpdateModal.classList.remove('show');
				loadAutomaticUpdates();
			} else {
				showToast('error', `Failed to save schedule: ${response.error}`);
			}
		})
		.catch(() => showToast('error', 'Error saving schedule'));
}

async function saveAutomaticRestarts() {
	const guid = loadedApplication;
	const identifier = `${loadedApplication}_restart`;
	const gameDir = (applicationData[guid] && applicationData[guid].hosts && applicationData[guid].hosts.filter(h => h.host === loadedHost)[0]) ? applicationData[guid].hosts.filter(h => h.host === loadedHost)[0].path : null;

	if (!gameDir) {
		showToast('error', 'Cannot determine game directory for this host.');
		return;
	}

	const schedule = parseCronSchedule(autoRestartModal);

	if (schedule === 'DISABLED') {
		// Delete existing identifier
		fetch(`/api/cron/${loadedHost}`, {
			method: 'DELETE',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({identifier})
		})
			.then(r => r.json())
			.then(response => {
				if (response.success) {
					showToast('success', 'Automatic restarts disabled.');
					autoRestartModal.classList.remove('show');
					loadAutomaticRestarts();
				} else {
					showToast('error', `Failed to disable automatic restarts: ${response.error}`);
				}
			})
			.catch(() => showToast('error', 'Error disabling automatic restarts'));
		return;
	}

	// Build command
	const command = `${gameDir}/manage.py --restart`;

	fetch(`/api/cron/${loadedHost}`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({schedule, command, identifier})
	})
		.then(r => r.json())
		.then(response => {
			if (response.success) {
				showToast('success', 'Automatic restarts scheduled.');
				autoRestartModal.classList.remove('show');
				loadAutomaticRestarts();
			} else {
				showToast('error', `Failed to save schedule: ${response.error}`);
			}
		})
		.catch(() => showToast('error', 'Error saving schedule'));
}

/**
 * Primary handler to load the application on page load
 */
window.addEventListener('DOMContentLoaded', () => {

	const {guid, host} = getPathParams('/application/configure/:guid/:host'),
		configurationContainer = document.getElementById('configurationContainer');

	Promise.all([
		loadApplication(guid),
		loadHost(host)
	])
		.then(() => {
			// Pull the configs from the service
			fetch(`/api/application/configs/${guid}/${host}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			})
				.then(response => response.json())
				.then(result => {
					if (result.success && result.configs) {
						const configs = result.configs,
							quickSearch = document.getElementById('quick-search');
						configurationContainer.innerHTML = '';
						buildOptionsForm(guid, host, configs);

						quickSearch.removeAttribute('disabled');
						quickSearch.addEventListener('keyup', e => {
							const searchTerm = e.target.value.toLowerCase();
							const configItems = configurationContainer.getElementsByClassName('form-group');

							Array.from(configItems).forEach(item => {
								const label = item.getElementsByTagName('label')[0];
								if (label.innerText.toLowerCase().includes(searchTerm)) {
									item.style.display = '';
								} else {
									item.style.display = 'none';
								}
							});
						});
					}
					else {
						configurationContainer.innerHTML = `<div class="error-message" role="alert">Unable to load service configuration, game may not support this feature.</div>`;
						console.error(result.error);
					}
				})
				.catch(e => {
					console.error('Error loading configuration options:', e);
					configurationContainer.innerHTML = '<div class="alert error-message" role="alert">Error loading configuration options.<br/>' + String(e) + '</div>';
				});

			// Pull automatic update checks
			loadAutomaticUpdates();
			loadAutomaticRestarts();

			configureAutoUpdateBtn.addEventListener('click', () => {
				autoUpdateModal.classList.add('show');
			});
			saveAutoUpdateBtn.addEventListener('click', () => {
				saveAutomaticUpdates();
			});

			configureAutoRestartBtn.addEventListener('click', () => {
				autoRestartModal.classList.add('show');
			});
			saveAutoRestartBtn.addEventListener('click', () => {
				saveAutomaticRestarts();
			});

			openUpdateBtn.addEventListener('click', () => {
				updateModal.classList.add('show');
			});
			confirmUpdateBtn.addEventListener('click', () => {
				confirmUpdateBtn.classList.add('disabled');
				const icon = confirmUpdateBtn.querySelector('i'),
					classes = icon.className;
				icon.className = 'fas fa-spinner fa-spin';

				stream(
					`/api/application/update/${guid}/${host}`,
					'POST',
					{},
					'',
					(event, data) => {
						terminalOutputHelper(updateModal.querySelector('.terminal'), event, data);
					}).then(() => {
					// Stream ended
					showToast('success', 'Update process completed.');
				}).catch(err => {
					showToast('error', 'Update process encountered an error. See terminal output for details.');
				}).finally(() => {
					icon.className = classes;
					confirmUpdateBtn.classList.remove('disabled');
				});
			});
		});
});