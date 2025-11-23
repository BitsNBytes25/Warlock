const logsContainer = document.getElementById('logsContainer');
let serviceIdentifier = null;
let lastLogs = [];

async function fetchLogs() {
	stream(
		`/api/service/logs/${loadedApplication}/${loadedHost}/${serviceIdentifier}`,
		'GET',
		{},
		null,
		(event, data) => {
			terminalOutputHelper(logsContainer, event, data);
		}
	);
/*
	fetch(, {
		method: 'GET',
	})
		.then(response => response.text())
		.then(result => {
			let lines = result.split('\n'),
				scrolledToBottom = logsContainer.scrollHeight - logsContainer.clientHeight <= logsContainer.scrollTop + 1;
			// Only update if there are new lines
			lines.forEach(line => {
				if (!lastLogs.includes(line) && line.trim() !== '') {
					const logEntry = document.createElement('div');
					logEntry.textContent = line;
					logsContainer.appendChild(logEntry);
				}
			});

			lastLogs = lines;
			// Scroll to bottom
			if (scrolledToBottom) {
				logsContainer.scrollTop = logsContainer.scrollHeight;
			}
		});*/
}

async function fetchService() {
	return fetch(`/api/service/${loadedApplication}/${loadedHost}/${serviceIdentifier}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
			if (result.success && result.service) {
				let actionButtons = [];

				if (result.service.status === 'running') {
					actionButtons.push(`
<button data-host="${loadedHost}" data-service="${serviceIdentifier}" data-action="stop" data-guid="${loadedApplication}" class="service-control action-stop">
	<i class="fas fa-stop"></i> Stop
</button>`);
				}
				else if (result.service.status === 'stopped') {
					actionButtons.push(`
<button data-host="${loadedHost}" data-service="${serviceIdentifier}" data-action="start" data-guid="${loadedApplication}" class="service-control action-start">
	<i class="fas fa-play"></i> Start
</button>`);
				}
				else if (result.service.status === 'starting') {
					actionButtons.push(`
<button data-host="${loadedHost}" data-service="${serviceIdentifier}" data-action="stop" data-guid="${loadedApplication}" class="service-control action-stop">
	<i class="fas fa-stop"></i> Stop
</button>`);
				}

				document.querySelector('.content-header-buttons').innerHTML = actionButtons.join(' ');
			} else {
				throw new Error('Failed to fetch service data.');
			}
		});
}


/**
 * Primary handler to load the application on page load
 */
window.addEventListener('DOMContentLoaded', () => {

	const [app_guid, host, service] = window.location.pathname.substring(14).split('/');

	Promise.all([
		loadApplication(app_guid),
		loadHost(host)
	])
		.then(() => {
			serviceIdentifier = service;

			document.querySelectorAll('.service-service-placeholder').forEach(el => {
				el.innerHTML = service;
			});

			fetchLogs();

			setInterval(() => {
				fetchService();
			}, 20000);

			fetchService();

		})
		.catch(e => {
			console.error(e);
			logsContainer.innerHTML = '<div class="alert alert-danger" role="alert">Error loading application or host data.</div>';
		});
});


// Dynamic events for various buttons
document.addEventListener('click', e => {
	if (e.target) {
		if (e.target.classList.contains('service-control') || e.target.closest('.service-control')) {
			let btn = e.target.classList.contains('service-control') ? e.target : e.target.closest('.service-control'),
				service = btn.dataset.service,
				action = btn.dataset.action,
				host = btn.dataset.host,
				guid = btn.dataset.guid;

			e.preventDefault();

			if (btn.classList.contains('disabled')) {
				return;
			}
			btn.classList.add('disabled');
			serviceAction(guid, host, service, action);
		}
	}

});