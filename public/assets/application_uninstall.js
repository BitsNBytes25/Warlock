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

				showToast('info', 'Uninstallation started. Check the terminal output for progress.');

				stream(
					`/api/application/${guid}/${host}`,
					'DELETE',
					{},
					null,
					(event, data) => {
						terminalOutputHelper(terminalOutput, event, data);
					}).then(() => {
						// Stream ended
						showToast('success', 'Uninstallation process completed.');
					})
					.catch(() => {
						showToast('error', 'Uninstallation process encountered an error. See terminal output for details.');
					})
					.finally(() => {
						// Re-enable button
						uninstallSpinner.style.display = 'none';
						uninstallIcon.style.display = 'inline-block';
						uninstallButton.classList.remove('disabled');
					});
			});
		})
		.catch(e => {
			console.error(e);
			document.querySelector('.content-body').innerHTML = '<div class="alert alert-danger" role="alert">Error loading application or host data.</div>';
		});
});