/**
 * Build the HTML for configuration options received from the server
 *
 * Populates to the container with the ID configurationContainer on the main page
 *
 * @param {string} app_guid
 * @param {string} host
 * @param {string} service
 * @param {AppConfigOption[]} options
 */
function buildOptionsForm(app_guid, host, service, options) {
	let target = document.getElementById('configurationContainer');

	if (options.length === 0) {
		target.innerHTML = '<div class="alert alert-info" role="alert">No configuration options available for this service.</div>';
		return;
	}

	options.forEach(option => {
		let formGroup = document.createElement('div'),
			id = `config-${option.option.toLowerCase().replace(' ', '-')}`;
		formGroup.className = 'form-group';

		let label = document.createElement('label');
		label.htmlFor = id;
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
				break;
			case 'int':
			case 'float':
				input = document.createElement('input');
				input.type = 'number';
				input.className = 'form-control';
				input.id = id;
				input.value = option.value;
				break;
			case 'text':
				input = document.createElement('textarea');
				input.className = 'form-control';
				input.id = id;
				input.value = option.value;
				break;
			case 'str':
			default:
				input = document.createElement('input');
				input.type = 'text';
				input.className = 'form-control';
				input.id = id;
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
			fetch(`/api/service/configs/${app_guid}/${host}/${service}`, {
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

/**
 * Primary handler to load the application on page load
 */
window.addEventListener('DOMContentLoaded', () => {

	const {app_guid, host, service} = getPathParams('/service/configure/:app_guid/:host/:service'),
		configurationContainer = document.getElementById('configurationContainer');

	Promise.all([
		loadApplication(app_guid),
		loadHost(host)
	])
		.then(() => {
			fetchService(app_guid, host, service)
				.then(serviceData => {
					document.querySelectorAll('.service-service-placeholder').forEach(el => {
						el.innerHTML = serviceData.service;
					});

					// Pull the configs from the service
					fetch(`/api/service/configs/${app_guid}/${host}/${service}`, {
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
								buildOptionsForm(app_guid, host, service, configs);
							}
							else {
								configurationContainer.innerHTML = `<div class="error-message" role="alert">Unable to load service configuration, game may not support this feature.</div>`;
								console.error(result.error);
							}
						});
				});
		})
		.catch(e => {
			console.error(e);
			configurationContainer.innerHTML = '<div class="alert alert-danger" role="alert">Error loading application or host data.</div>';
		});
});