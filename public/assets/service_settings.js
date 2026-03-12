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