/**
 * Build the DOM for the quick search input for filtering configuration options
 *
 * @param {Element} target
 */
function buildOptionsSearch(target) {
	let containerGroup = document.createElement('div'),
		header = document.createElement('h3'),
		msg = document.createElement('div'),
		formGroup = document.createElement('div'),
		input = document.createElement('input');

	containerGroup.classList.add('options-group');
	header.innerText = 'Quick Search';
	msg.classList.add('info-message');
	msg.innerHTML = '<p>Filter to quickly find an option by its name.</p>';
	formGroup.classList.add('form-group', 'search-group');
	input.type = 'search';
	input.placeholder = 'Quick Filter';

	containerGroup.appendChild(header);
	formGroup.appendChild(input);
	msg.appendChild(formGroup);
	containerGroup.appendChild(msg);

	input.addEventListener('keyup', e => {
		const searchTerm = e.target.value.toLowerCase();
		const configItems = target.getElementsByClassName('form-group');

		Array.from(configItems).forEach(item => {
			if (item.classList.contains('search-group')) {
				return;
			}

			const label = item.getElementsByTagName('label')[0];
			if (label.innerText.toLowerCase().includes(searchTerm)) {
				item.style.display = '';
			} else {
				item.style.display = 'none';
			}
		});
	});

	target.appendChild(containerGroup);
}

/**
 * Build the HTML for configuration options received from the server
 *
 * Populates to the container with the ID configurationContainer on the main page
 *
 * @param {string} app_guid
 * @param {string} host
 * @param {string} service
 * @param {Element} target
 * @param {AppConfigOption[]} options
 * @param {string[]|null} include - If provided, only include options whose name is in this list
 * @param {string[]|null} exclude - If provided, exclude options whose name is in this list
 * @returns {void}
 */
function buildOptionsForm(
	app_guid,
	host,
	service,
	target,
	options,
	include = null,
	exclude = null
) {
	let serviceRunning = loadedServiceData.status !== 'stopped',
		groups = {},
		optionCount = 0;

	options.forEach(option => {
		let formGroup = document.createElement('div'),
			name = option.option.toLowerCase().replace(/[^a-z]/g, '-').replace(/[-]+/g, '-').replace(/-$/, ''),
			id = `config-${service ? 'service' : 'app'}-${name}`,
			containerGroup,
			group = option.group || 'Options';
		formGroup.className = 'form-group';

		if (include && !include.includes(group)) {
			return;
		}

		if (exclude && exclude.includes(group)) {
			return;
		}

		optionCount++;

		if (group in groups) {
			containerGroup = groups[group];
		}
		else {
			containerGroup = document.createElement('div');
			containerGroup.classList.add('options-group');
			let header = document.createElement('h3');
			header.innerText = group;
			containerGroup.appendChild(header);
			groups[group] = containerGroup;
		}


		let label = document.createElement('label');
		label.htmlFor = id;
		label.className = 'form-label';
		label.innerHTML = option.option + '<i class="fas fa-spin fa-spinner save-indicator" title="Saving..."></i>';

		let help = null;
		if (option.help) {
			help = document.createElement('p');
			help.className = 'help-text';
			help.innerText = option.help;
		}

		// Support for configs with a list of options instead of freeform input
		if ('options' in option && Array.isArray(option.options) && option.options.length > 0) {
			if (option.type === 'list') {
				// List of options should be a checkbox group.
				option.type = 'checkboxes';
			}
			else {
				option.type = 'select';
			}
		}

		let input;
		switch (option.type) {
			case 'select':
				input = document.createElement('select');
				input.className = 'form-select';
				input.id = id;
				option.options.forEach(opt => {
					let optElement = document.createElement('option');
					optElement.value = opt;
					optElement.text = opt;
					if (opt === option.value) {
						optElement.selected = true;
					}
					input.appendChild(optElement);
				});
				if (serviceRunning) {
					input.disabled = true;
				}
				break;
			case 'checkboxes':
				input = document.createElement('div');
				input.className = 'form-values';
				input.id = id;
				option.options.forEach(opt => {
					let checkboxDiv = document.createElement('div');
					checkboxDiv.className = 'form-check';

					let checkboxInput = document.createElement('input');
					checkboxInput.type = 'checkbox';
					checkboxInput.className = 'form-check-input';
					checkboxInput.id = `${id}-${String(opt).toLowerCase().replace(' ', '-')}`;
					checkboxInput.value = opt;
					if (Array.isArray(option.value) && option.value.includes(opt)) {
						checkboxInput.checked = true;
					}
					if (serviceRunning) {
						checkboxInput.readOnly = true;
					}

					let checkboxLabel = document.createElement('label');
					checkboxLabel.className = 'form-check-label';
					checkboxLabel.htmlFor = `${id}-${String(opt).toLowerCase().replace(' ', '-')}`;
					checkboxLabel.innerText = opt;

					checkboxDiv.appendChild(checkboxInput);
					checkboxDiv.appendChild(checkboxLabel);
					input.appendChild(checkboxDiv);
				});
				break;
			case 'bool':
				input = document.createElement('input');
				input.type = 'checkbox';
				input.className = 'form-check-input';
				input.id = id;
				input.checked = option.value === true || option.value === 'true';
				if (serviceRunning) {
					input.disabled = true;
				}
				break;
			case 'int':
			case 'float':
				input = document.createElement('input');
				input.type = 'number';
				input.className = 'form-control';
				input.id = id;
				input.value = option.value;
				if (serviceRunning) {
					input.readOnly = true;
					input.disabled = true;
				}
				break;
			case 'text':
				input = document.createElement('textarea');
				input.className = 'form-control';
				input.id = id;
				input.value = option.value;
				if (serviceRunning) {
					input.readOnly = true;
					input.disabled = true;
				}
				break;
			case 'str':
			default:
				input = document.createElement('input');
				input.type = 'text';
				input.className = 'form-control';
				input.id = id;
				input.value = option.value;
				if (serviceRunning) {
					input.readOnly = true;
					input.disabled = true;
				}
				break;
		}

		input.dataset.service = service;

		formGroup.appendChild(label);
		if (help) {
			formGroup.appendChild(help);
		}
		formGroup.appendChild(input);
		containerGroup.appendChild(formGroup);

		// Add event handler on input to live-save changes to the backend
		input.addEventListener('change', (event) => {
			if (loadedServiceData.status !== 'stopped') {
				return;
			}

			let newValue,
				group = event.target.closest('.form-group');

			group.classList.add('saving');

			if (event.target.closest('.form-values')) {
				// This is a checkboxes group
				newValue = [];
				let group = event.target.closest('.form-values');
				group.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
					if (checkbox.checked) {
						newValue.push(checkbox.value);
					}
				});
			}
			else if (option.type === 'bool') {
				newValue = event.target.checked;
			}
			else if (option.type === 'int') {
				newValue = parseInt(event.target.value, 10);
			}
			else if (option.type === 'float') {
				newValue = parseFloat(event.target.value);
			}
			else {
				newValue = event.target.value;
			}

			// Send update to backend

			// Support both service-level and application-level configs
			let target;
			if (event.target.dataset.service) {
				target = `/api/service/configs/${app_guid}/${host}/${service}`;
			}
			else {
				target = `/api/application/configs/${app_guid}/${host}`;
			}
			fetch(target, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ [option.option]: newValue })
			})
				.then(response => response.json())
				.then(result => {
					group.classList.remove('saving');
					if (result.success) {
						showToast('success', `Configuration option ${option.option} updated successfully.`);
					} else {
						showToast('error', `Failed to update configuration option ${option.option}: ${result.error}`);
					}
				})
				.catch(error => {
					group.classList.remove('saving');
					showToast('error', `Failed to update configuration option ${option.option}: ${error}`);
					console.error(`Error updating configuration option ${option.option}:`, error);
				});
		});
	});

	if (optionCount >= 10) {
		buildOptionsSearch(target);
	}
	else if (optionCount === 0) {
		target.innerHTML = '<div class="alert alert-info" role="alert">No configuration options available for this service.</div>';
		return;
	}

	// Now groups should contain the list of groups to render.
	// We want to render "Basic", followed by all the rest, followed by "Advanced".
	if ('Basic' in groups) {
		target.appendChild(groups['Basic']);
	}

	Object.keys(groups).forEach(groupName => {
		if (groupName !== 'Basic' && groupName !== 'Advanced') {
			target.appendChild(groups[groupName]);
		}
	});

	if ('Advanced' in groups) {
		target.appendChild(groups['Advanced']);
	}
}

async function loadServiceConfigure() {
	const app_guid = loadedApplication || null,
		host = loadedHost || null,
		service = loadedService || null,
		configurationContainer = document.getElementById('configurationContainer');

	if (!host || !service || !app_guid) {
		console.error('Host, service, or app guid not specified for loading service configuration');
		return;
	}

	// Pull the configs from the service
	fetch(`/api/service/configs/${app_guid}/${host}/${service}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
			configurationContainer.innerHTML = '';

			if (result.success && result.configs) {
				const configs = result.configs;
				buildOptionsForm(app_guid, host, service, configurationContainer, configs, null, ['Settings']);
			}

			if (configurationContainer.querySelectorAll('input').length === 0) {
				configurationContainer.innerHTML = '<div class="alert alert-info" role="alert">No configuration options available for this service.</div>';
			}
		});
}

async function loadAppConfigure() {
	const app_guid = loadedApplication || null,
		host = loadedHost || null,
		service = loadedService || null,
		configurationContainer = document.getElementById('appConfigurationContainer');

	if (!host || !service || !app_guid) {
		console.error('Host, service, or app guid not specified for loading service configuration');
		return;
	}

	// Pull the configs for the application (shared by all services)
	fetch(`/api/application/configs/${app_guid}/${host}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
			configurationContainer.innerHTML = '';

			if (result.success && result.configs) {
				const configs = result.configs;
				buildOptionsForm(app_guid, host, '', configurationContainer, configs);
			}

			if (configurationContainer.querySelectorAll('input').length === 0) {
				configurationContainer.innerHTML = '<div class="alert alert-info" role="alert">No configuration options available for this application.</div>';
			}
		});
}

document.addEventListener('serviceStatusChange', e => {
	if (e.detail.value !== 'stopped') {
		document.getElementById('optionsMessageNormal').style.display = 'none';
		document.getElementById('optionsMessageActive').style.display = 'block';
	}
	else {
		document.getElementById('optionsMessageNormal').style.display = 'block';
		document.getElementById('optionsMessageActive').style.display = 'none';
	}

	document.getElementById('configurationContainer').querySelectorAll('input, select, textarea').forEach(el => {
		if (e.detail.value !== 'stopped') {
			el.readOnly = true;
			el.disabled = true;
		}
		else {
			el.readOnly = false;
			el.disabled = false;
		}
	});
});