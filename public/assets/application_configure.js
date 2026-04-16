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
