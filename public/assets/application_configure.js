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
	uninstallBtn = document.getElementById('uninstallBtn'),
	delayedUpdate = document.getElementById('delayedUpdate'),
	autoUpdateSchedule = document.getElementById('autoUpdateSchedule'),
	automatedStartDisabledMessage = document.getElementById('automatedStartDisabledMessage'),
	automatedStartEnabledMessage = document.getElementById('automatedStartEnabledMessage'),
	configureAutoStartEnableBtn = document.getElementById('configureAutoStartEnableBtn'),
	configureAutoStartDisableBtn = document.getElementById('configureAutoStartDisableBtn');






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




// Events
reinstallBtn.addEventListener('click', () => {
	window.location.href = `/application/install/${loadedApplication}/${loadedHost}`;
});

uninstallBtn.addEventListener('click', () => {
	window.location.href = `/application/uninstall/${loadedApplication}/${loadedHost}`;
});

configureAutoUpdateBtn.addEventListener('click', () => {
	openModal(autoUpdateModal);
});
saveAutoUpdateBtn.addEventListener('click', () => {
	saveAutomaticUpdates();
});

saveAutoRestartBtn.addEventListener('click', () => {
	saveAutomaticRestarts();
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