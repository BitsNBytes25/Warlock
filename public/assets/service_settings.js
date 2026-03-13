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

async function loadAutomaticUpdates() {
    if (!loadedHost) {
        return;
    }
    const hostData = getHostInstallData(loadedApplication, loadedHost),
        appVersion = hostData.version;

    let identifier;
    if (appVersion >= 2 && loadedServiceData.multi_binary) {
        identifier = `${loadedApplication}_${loadedService}_update`;
    }
    else {
        identifier = `${loadedApplication}_update`;
    }

    loadCronJob(loadedHost, identifier).then(job => {
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
    const hostData = getHostInstallData(loadedApplication, loadedHost),
        appVersion = hostData.version;

    let identifier;
    if (appVersion >= 2) {
        identifier = `${loadedApplication}_${loadedService}_restart`;
    }
    else {
        identifier = `${loadedApplication}_restart`;
    }

    loadCronJob(loadedHost, identifier).then(job => {
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

function loadServiceSettings() {
    // Pull automatic update checks
    loadAutomaticUpdates();
    loadAutomaticRestarts();

    fetch(`/api/service/configs/${loadedApplication}/${loadedHost}/${loadedService}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => response.json())
        .then(result => {
            let configurationContainer = document.getElementById('service-setting-configs');

            configurationContainer.innerHTML = '';

            if (result.success && result.configs) {
                const configs = result.configs;
                buildOptionsForm(loadedApplication, loadedHost, loadedService, configurationContainer, configs, ['Settings'], null);
            }
        });
}

configureAutoUpdateBtn.addEventListener('click', () => {
    // Only mutli-binary services should send the service tag, otherwise just the host/app is sufficient.
    let serviceToSend = loadedServiceData.multi_binary ? loadedService : null;

    openAutoUpdateModal(loadedHost, loadedApplication, serviceToSend, () => {
        loadAutomaticUpdates();
    });
});

openUpdateBtn.addEventListener('click', () => {
    // Only mutli-binary services should send the service tag, otherwise just the host/app is sufficient.
    let serviceToSend = loadedServiceData.multi_binary ? loadedService : null;
    openUpdateModal(loadedHost, loadedApplication, serviceToSend);
});

configureAutoRestartBtn.addEventListener('click', () => {
    openAutoRestartModal(loadedHost, loadedApplication, loadedService, () => {
        loadAutomaticRestarts();
    });
})


document.addEventListener('serviceChange', e => {
    if (e.detail.key === 'enabled') {
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
    }
});