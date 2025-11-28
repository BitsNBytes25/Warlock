const autoUpdateModal = document.getElementById('autoUpdateModal'),
	configureAutoUpdateBtn = document.getElementById('configureAutoUpdateBtn'),
	automatedUpdatesDisabledMessage = document.getElementById('automatedUpdatesDisabledMessage'),
	automatedUpdatesEnabledMessage = document.getElementById('automatedUpdatesEnabledMessage'),
	saveAutoUpdateBtn = document.getElementById('saveAutoUpdateBtn');

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
		target.innerHTML = '<div class="alert alert-info" role="alert">No configuration options available for this service.</div>';
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
	const command = `${gameDir}/manage.py --check-updates && ${gameDir}/manage.py --restart`;

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
						const configs = result.configs;
						console.debug(configs);
						buildOptionsForm(guid, host, configs);
					}
				});

			// Pull automatic update checks
			loadAutomaticUpdates();

			configureAutoUpdateBtn.addEventListener('click', () => {
				autoUpdateModal.classList.add('show');
			});
			saveAutoUpdateBtn.addEventListener('click', () => {
				saveAutomaticUpdates();
			});
		});
});