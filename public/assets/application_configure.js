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
	confirmUpdateBtn = document.getElementById('confirmUpdateBtn'),
	reinstallBtn = document.getElementById('reinstallBtn'),
	delayedUpdate = document.getElementById('delayedUpdate'),
	autoUpdateSchedule = document.getElementById('autoUpdateSchedule'),
	automatedStartDisabledMessage = document.getElementById('automatedStartDisabledMessage'),
	automatedStartEnabledMessage = document.getElementById('automatedStartEnabledMessage'),
	configureAutoStartEnableBtn = document.getElementById('configureAutoStartEnableBtn'),
	configureAutoStartDisableBtn = document.getElementById('configureAutoStartDisableBtn');


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

		if (!checkHostAppHasOption(loadedApplication, loadedHost, 'delayed-update')) {
			delayedUpdate.closest('.form-group').querySelector('p').textContent = 'Note: this game does not support delayed updates.';
			delayedUpdate.disabled = true;
			delayedUpdate.checked = false;
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
	let command;

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
					closeModal(autoUpdateModal);
					loadAutomaticUpdates();
				} else {
					showToast('error', `Failed to disable automatic updates: ${response.error}`);
				}
			})
			.catch(() => showToast('error', 'Error disabling automatic updates'));
		return;
	}

	if (checkHostAppHasOption(loadedApplication, loadedHost, 'delayed-update') && delayedUpdate.checked) {
		// Build command for delayed updates
		command = `${gameDir}/manage.py --check-update && ${gameDir}/manage.py --delayed-update`;
	}
	else {
		command = `! ${gameDir}/manage.py --has-players && ${gameDir}/manage.py --check-update && ${gameDir}/manage.py --update`;
	}

	fetch(`/api/cron/${loadedHost}`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({schedule, command, identifier})
	})
		.then(r => r.json())
		.then(response => {
			if (response.success) {
				showToast('success', 'Automatic updates scheduled.');
				closeModal(autoUpdateModal);
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
					closeModal(autoRestartModal);
					loadAutomaticRestarts();
				} else {
					showToast('error', `Failed to disable automatic restarts: ${response.error}`);
				}
			})
			.catch(() => showToast('error', 'Error disabling automatic restarts'));
		return;
	}

	// Build command
	// if this service supports delayed-restart, use that instead
	let command;
	if (checkHostAppHasOption(loadedApplication, loadedHost, 'delayed-restart')) {
		command = `${gameDir}/manage.py --delayed-restart`;
	} else {
		command = `${gameDir}/manage.py --restart`;
	}

	fetch(`/api/cron/${loadedHost}`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({schedule, command, identifier})
	})
		.then(r => r.json())
		.then(response => {
			if (response.success) {
				showToast('success', 'Automatic restarts scheduled.');
				closeModal(autoRestartModal);
				loadAutomaticRestarts();
			} else {
				showToast('error', `Failed to save schedule: ${response.error}`);
			}
		})
		.catch(() => showToast('error', 'Error saving schedule'));
}

function loadServiceSettings() {
	// Pull automatic update checks
	loadAutomaticUpdates();
	loadAutomaticRestarts();
}


// Events
reinstallBtn.addEventListener('click', () => {
	window.location.href = `/application/install/${loadedApplication}/${loadedHost}`;
});

configureAutoUpdateBtn.addEventListener('click', () => {
	openModal(autoUpdateModal);
});
saveAutoUpdateBtn.addEventListener('click', () => {
	saveAutomaticUpdates();
});

configureAutoRestartBtn.addEventListener('click', () => {
	openModal(autoRestartModal);
});
saveAutoRestartBtn.addEventListener('click', () => {
	saveAutomaticRestarts();
});

openUpdateBtn.addEventListener('click', () => {
	openModal(updateModal);
});
autoUpdateSchedule.addEventListener('change', () => {
	if (autoUpdateSchedule.value === 'disabled') {
		delayedUpdate.closest('.form-group').style.display = 'none';
	}
	else {
		delayedUpdate.closest('.form-group').style.display = 'flex';
	}
});
confirmUpdateBtn.addEventListener('click', () => {
	confirmUpdateBtn.classList.add('disabled');
	const icon = confirmUpdateBtn.querySelector('i'),
		classes = icon.className;
	icon.className = 'fas fa-spinner fa-spin';

	stream(
		`/api/application/update/${loadedApplication}/${loadedHost}`,
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

document.addEventListener('serviceEnabledChange', e => {
	if (e.detail.value) {
		automatedStartDisabledMessage.style.display = 'none';
		automatedStartEnabledMessage.style.display = 'flex';
		configureAutoStartEnableBtn.style.display = 'none';
		configureAutoStartDisableBtn.style.display = 'inline-flex';
	}
	else {
		automatedStartDisabledMessage.style.display = 'flex';
		automatedStartEnabledMessage.style.display = 'none';
		configureAutoStartEnableBtn.style.display = 'inline-flex';
		configureAutoStartDisableBtn.style.display = 'none';
	}
});