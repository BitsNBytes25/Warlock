/**
 * Primary handler to load the application on page load
 */
window.addEventListener('DOMContentLoaded', () => {

	const {guid, host} = getPathParams('/application/uninstall/:guid/:host');

	Promise.all([
		loadApplication(guid),
		loadHost(host)
	])
		.then(() => {
			const uninstallButton = document.getElementById('btnUninstall'),
				terminalOutput = document.getElementById('output'),
				uninstallSpinner = document.getElementById('uninstallSpinner'),
				uninstallIcon = document.getElementById('uninstallIcon');

			uninstallButton.addEventListener('click', e => {
				e.preventDefault();

				if (uninstallButton.classList.contains('disabled')) {
					return;
				}

				uninstallButton.classList.add('disabled');
				terminalOutput.innerHTML = '';
				terminalOutput.style.display = 'block';
				uninstallSpinner.style.display = 'inline-block';
				uninstallIcon.style.display = 'none';

				stream(
					`/api/application/uninstall/${guid}/${host}`,
					'POST',
					{},
					null,
					(event, data) => {
						if (event === 'done' || event === 'error') {
							uninstallSpinner.style.display = 'none';
							uninstallIcon.style.display = 'inline-block';
							uninstallButton.classList.remove('disabled');
						}

						// Process terminal escape codes present in data
						data = parseTerminalCodes(data);

						terminalOutput.innerHTML += data + '\n';
						terminalOutput.scrollTop = terminalOutput.scrollHeight;
					});
			});
		})
		.catch(e => {
			console.error(e);
			document.querySelector('.content-body').innerHTML = '<div class="alert alert-danger" role="alert">Error loading application or host data.</div>';
		});
});