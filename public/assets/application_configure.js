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
	reinstallBtn = document.getElementById('reinstallBtn');


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
	const command = `! ${gameDir}/manage.py --has-players && ${gameDir}/manage.py --check-update && ${gameDir}/manage.py --update`;

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

	const {guid, host} = getPathParams('/application/configure/:guid/:host');

	Promise.all([
		loadApplication(guid),
		loadHost(host)
	])
		.then(() => {
			// Pull automatic update checks
			loadAutomaticUpdates();
			loadAutomaticRestarts();

			reinstallBtn.classList.remove('disabled');
			reinstallBtn.addEventListener('click', () => {
				window.location.href = `/application/install/${guid}/${host}`;
			});

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