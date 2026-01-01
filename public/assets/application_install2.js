/**
 * Primary handler to load the application on page load
 */

function parseSyntaxLine(line) {
	let option, hasValue, valType, desc, defaultValue;

	if (!line || !line.trim()) return null;
	const trimmed = line.trim();
	// separate the option token (first token) from the description
	const m = trimmed.match(/^(\S+)(?:\s+(.*))?$/);
	if (!m) return null;
	const token = m[1];
	desc = m[2] ? m[2].trim() : '';
	if (desc.startsWith('-')) {
		desc = desc.replace(/^-+\s*/, '');
	}
	if (desc.includes('DEFAULT=')) {
		defaultValue = desc.match(/DEFAULT=([^\s]+)/);
		if (defaultValue) {
			defaultValue = defaultValue[1];
		}
	}
	hasValue = token.includes('=');
	valType = null;
	option = token;
	if (hasValue) {
		const parts = token.split(/=(.+)/);
		option = parts[0];
		valType = parts[1] ? parts[1].replace(/^<|>$/g, '') : null;
	}

	if (option === '--branch') {
		// Special case for --branch to indicate it's a git branch
		valType = '|'; // will be populated later
	}

	return { option, hasValue, valType, desc, defaultValue };
}

function createOptionElement(spec) {
	const wrapper = document.createElement('div');
	wrapper.className = 'form-group';

	const safeId = 'opt-' + spec.option.replace(/[^a-z0-9_-]/gi, '_');

	const label = document.createElement('label');
	label.setAttribute('for', safeId);
	label.className = 'install-option-label';
	label.textContent = spec.option.replace(/-+/g, ' ').trim();
	wrapper.appendChild(label);

	if (spec.hasValue) {
		let input;
		if (spec.valType) {
			if (spec.valType.includes('|')) {
				// Select dropdown to pick which option to use
				input = document.createElement('select');
				const options = spec.valType.split('|').map(opt => opt.trim());
				for (const opt of options) {
					const optionEl = document.createElement('option');
					if (spec.defaultValue && spec.defaultValue === opt) {
						optionEl.selected = true;
					}
					optionEl.value = opt;
					optionEl.textContent = opt;
					input.appendChild(optionEl);
				}
			}
			else if (['number', 'int', 'float'].includes(spec.valType.toLowerCase())) {
				input = document.createElement('input');
				input.type = 'number';
			}
			else {
				input = document.createElement('input');
				input.type = 'text';
			}
		}

		input.id = safeId;
		input.name = spec.option;
		input.className = 'install-option-input';
		wrapper.appendChild(input);
	} else {
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.id = safeId;
		input.name = spec.option;
		input.className = 'install-option-checkbox';
		wrapper.appendChild(input);
	}

	if (spec.desc) {
		const desc = document.createElement('p');
		desc.className = 'install-option-desc';
		desc.textContent = spec.desc;
		wrapper.appendChild(desc);
	}

	return wrapper;
}

window.addEventListener('DOMContentLoaded', () => {

	const {guid, host} = getPathParams('/application/install/:guid/:host'),
		installOptions = document.getElementById('installOptions'),
		btnInstall = document.getElementById('btnInstall'),
		terminalOutput = document.getElementById('output'),
		installSpinner = document.getElementById('installSpinner'),
		installIcon = document.getElementById('installIcon');

	loadApplication(guid).then(appData => {
		loadHost(host).then(hostData => {
			console.log('LOADED', appData, hostData);

			// appData.syntax may be an array of strings,
			// each string in the format of "--cli-argument Description of argument"
			// Options which support values will be in the format of "--cli-argument=<name> Description of argument"

			// Clear any existing options
			if (!installOptions) return;
			installOptions.innerHTML = '';

			const lines = Array.isArray(appData.syntax) ? appData.syntax : [];
			let added = 0;
			for (const line of lines) {
				const parsed = parseSyntaxLine(line);
				if (!parsed) continue;

				// Skip default/assumed flags
				if (parsed.option === '--non-interactive' || parsed.option === '--uninstall') continue;

				const el = createOptionElement(parsed);
				installOptions.appendChild(el);
				added++;

				if (parsed.option === '--branch') {
					// Pull the branches available from appData.source (usually "github") and appData.repo (repo author/name)
					getRepoBranches(appData.source, appData.repo).then(branches => {
						let target = document.getElementById('opt---branch');
						target.innerHTML = '';
						branches.forEach(branch => {
							const optionEl = document.createElement('option');
							optionEl.value = branch.branch;
							optionEl.textContent = `${branch.branch[0].toUpperCase()}${branch.branch.substring(1)} - Released ${branch.date}`;
							if (branch.default) {
								optionEl.selected = true;
								optionEl.textContent += ' (default)';
							}

							target.appendChild(optionEl);
						});
					}).catch(err => {
						console.error('Error fetching branches:', err);
					});
				}
			}

			if (added === 0) {
				const p = document.createElement('p');
				p.className = 'no-install-options';
				p.textContent = 'No configurable options for this installer.';
				installOptions.appendChild(p);
			}

			btnInstall.addEventListener('click', () => {
				if (btnInstall.classList.contains('disabled')) {
					return;
				}

				btnInstall.classList.add('disabled');
				installSpinner.style.display = 'inline-block';
				installIcon.style.display = 'none';

				// Gather options
				const optionElements = installOptions.querySelectorAll('input,select');
				const options = [];
				optionElements.forEach(input => {
					if (input.type === 'checkbox') {
						if (input.checked) {
							options.push(input.name);
						}
					} else {
						if (input.value && input.value.trim()) {
							options.push(`${input.name}=${input.value.trim()}`);
						}
					}
				});

				showToast('info', 'Installation started. See terminal output for progress.');

				terminalOutput.style.display = 'block';
				stream(
					`/api/application/${guid}/${host}`,
					'PUT',
					{'Content-Type': 'application/json'},
					JSON.stringify({options: options}),
					(event, data) => {
						terminalOutputHelper(terminalOutput, event, data);
					}).then(() => {
						// Stream ended
						showToast('success', 'Installation process completed.');
					}).catch(err => {
						showToast('error', 'Installation process encountered an error. See terminal output for details.');
					}).finally(() => {
						installSpinner.style.display = 'none';
						installIcon.style.display = 'inline-block';
						btnInstall.classList.remove('disabled');
					});
			});

		});
	});
});
