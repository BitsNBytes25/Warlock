const cronContainer = document.getElementById('cronJobsContainer'),
	cronTableBody = document.getElementById('cronTableBody'),
	btnAddCronJob = document.getElementById('btnAddCronJob'),
	addCronJobModal = document.getElementById('addCronJobModal'),
	saveCronJobBtn = document.getElementById('saveCronJobBtn'),
	cronCommand = document.getElementById('cronCommand');

/**
 * Load cron jobs
 */
function loadCronJobs() {
	if (!cronTableBody) return;

	cronTableBody.innerHTML = '<tr><td colspan="3"><div><i class="fas fa-spinner fa-spin"></i> Loading cron jobs...</div></td></tr>';

	fetch(`/api/cron/${loadedHost}`)
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				renderCronJobs(data.jobs);
			} else {
				cronTableBody.innerHTML = `<tr><td colspan="3"><div class="error-message">${data.error || 'Error loading cron jobs'}</div></td></tr>`;
			}
		})
		.catch(error => {
			console.error('Error loading cron jobs:', error);
			cronTableBody.innerHTML = '<tr><td colspan="3"><div class="error-message">Error loading cron jobs.</div></td></tr>';
		});
}

function renderCronJobs(jobs) {
	cronTableBody.innerHTML = '';

	if (!jobs || jobs.length === 0) {
		cronTableBody.innerHTML = '<tr><td colspan="3">No cron jobs configured.</td></tr>';
		return;
	}

	jobs.forEach(job => {
		const row = document.createElement('tr');
		row.dataset.identifier = job.identifier;
		row.dataset.schedule = job.schedule || '';

		let scheduleDisplay = job.schedule ? formatCronSchedule(job.schedule) : 'N/A',
			actions = '';

		if (!job.is_warlock) {
			actions = `<button class="action-edit">
	<i class="fas fa-edit"></i>
</button>
<button class="action-remove">
	<i class="fas fa-trash"></i>
</button>`;
		}
		else {
			actions = '<em>Managed by Warlock</em>';
		}

		row.innerHTML = `
            <td>${scheduleDisplay}</td>
            <td><code class="cmd">${job.command || 'N/A'}</code></td>
            <td>${actions}</td>
        `;
		cronTableBody.appendChild(row);

		if (!job.is_warlock) {
			row.querySelector('.action-edit').addEventListener('click', editCronJob);
			row.querySelector('.action-remove').addEventListener('click', deleteCronJob);
		}
	});
}

function editCronJob(e) {
	const row = e.target.closest('tr');

	populateCronJob({
		schedule: row.dataset.schedule
	}, addCronJobModal);
	cronCommand.value = row.querySelector('.cmd').innerText;
	saveCronJobBtn.dataset.identifier = row.dataset.identifier;
	openModal(addCronJobModal);
}

function deleteCronJob(e) {
	const row = e.target.closest('tr');

	if (!confirm('Are you sure you want to delete this cron job?')) {
		return;
	}

	fetch(`/api/cron/${loadedHost}`, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: row.dataset.identifier })
	})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				showToast('success', 'Cron job deleted successfully');
				loadCronJobs();
			}
			else {
				showToast('error', data.error || 'Error deleting cron job');
			}
		})
		.catch(error => {
			console.error('Error deleting cron job:', error);
			showToast('error', 'Error deleting cron job');
		});
}

// Setup button handlers
document.addEventListener('DOMContentLoaded', () => {
	btnAddCronJob.addEventListener('click', () => {
		openModal(addCronJobModal);
		cronCommand.value = '';
		saveCronJobBtn.dataset.identifier = '';
		populateCronJob(null, addCronJobModal);
	});

	// Save button handler
	if (saveCronJobBtn) {
		saveCronJobBtn.addEventListener('click', () => {
			const identifier = saveCronJobBtn.dataset.identifier,
				schedule = parseCronSchedule(addCronJobModal),
				command = document.getElementById('cronCommand').value;

			if (!schedule || !command) {
				showToast('error', 'All fields are required');
				return;
			}

			const job = { identifier, schedule, command };

			fetch(`/api/cron/${loadedHost}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(job)
			})
				.then(response => response.json())
				.then(data => {
					if (data.success) {
						showToast('success', 'Cron job added successfully');
						closeModal(addCronJobModal);
						loadCronJobs();
					} else {
						showToast('error', data.error || 'Error adding cron job');
					}
				})
				.catch(error => {
					console.error('Error adding cron job:', error);
					showToast('error', 'Error adding cron job');
				});
		});
	}
});
