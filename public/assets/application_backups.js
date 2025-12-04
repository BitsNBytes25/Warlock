const backupsList = document.getElementById('backupsList'),
	performBackupBtn = document.getElementById('performBackupBtn'),
	backupModal = document.getElementById('backupModal'),
	confirmBackupBtn = document.getElementById('confirmBackupBtn'),
	confirmRestoreBtn = document.getElementById('confirmRestoreBtn'),
	restoreModal = document.getElementById('restoreModal'),
	deleteModal = document.getElementById('deleteModal'),
	confirmDeleteBtn = document.getElementById('confirmDeleteBtn'),
	configureAutoBackupBtn = document.getElementById('configureAutoBackupBtn'),
	automatedBackupsDisabledMessage = document.getElementById('automatedBackupsDisabledMessage'),
	automatedBackupsEnabledMessage = document.getElementById('automatedBackupsEnabledMessage'),
	autoBackupModal = document.getElementById('autoBackupModal'),
	autoBackupSchedule = document.getElementById('autoBackupSchedule'),
	autoBackupKeep = document.getElementById('autoBackupKeep'),
	saveAutoBackupBtn = document.getElementById('saveAutoBackupBtn'),
	uploadBtn = document.getElementById('uploadBtn'),
	fileInput = document.getElementById('fileInput');

let backupPath;

/**
 * Render a single backup file item
 *
 * @param {Object<modified: integer, name: string, size: integer, name: string>} fileData
 */
function renderBackupFile(fileData) {
	const fileItem = document.createElement('div');
	fileItem.classList.add('backup-file-item');
	fileItem.innerHTML = `
		<div class="file-modified">${convertTimestampToDateTimeString(fileData.modified)}</div>
		<div class="file-size">${formatFileSize(fileData.size)}</div>
		<div class="file-actions button-group">
			<button class="action-download">
				<i class="fas fa-download"></i>
				Download
			</button>
			<button class="action-restore">
				<i class="fas fa-undo"></i>
				Restore
			</button>
			<button class="action-remove">
				<i class="fas fa-trash"></i>
				Delete
			</button>
		</div>`;

	fileItem.querySelector('.action-download').addEventListener('click', () => {
		window.open(`/api/file/${loadedHost}?path=${fileData.path}&download=1`, '_blank');
	});
	fileItem.querySelector('.action-restore').addEventListener('click', () => {
		confirmRestoreBtn.dataset.file = fileData.name;
		restoreModal.querySelector('.warning-message').style.display = 'flex';
		restoreModal.querySelector('.terminal').style.display = 'none';
		restoreModal.classList.add('show');
	});
	fileItem.querySelector('.action-remove').addEventListener('click', () => {
		confirmDeleteBtn.dataset.path = fileData.path;
		deleteModal.classList.add('show');
	});

	return fileItem;
}

async function loadBackupsList() {
	if (!backupPath) {
		backupsList.innerHTML = '<p class="error-message">Backup path is not defined.</p>';
		return;
	}
	if (!loadedHost) {
		backupsList.innerHTML = '<p class="error-message">Host data is not loaded.</p>';
		return;
	}

	backupsList.innerHTML = '<div><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

	fetch(`/api/files/${loadedHost}?path=${backupPath}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				backupsList.innerHTML = '';
				// Sort them by modified timestamp, descending
				data.files.sort((a, b) => b.modified - a.modified);

				data.files.forEach(fileData => {
					if (fileData.name.endsWith('.tar.gz')) {
						backupsList.appendChild(renderBackupFile(fileData));
					}
				});
				console.log(data.files);
			}
			else {
				showToast('error', `Failed to load directory: ${data.error}`);
			}
		});
}

async function loadAutomaticBackupConfig() {
	if (!loadedHost) {
		return;
	}
	const identifier = `${loadedApplication}_backup`;

	loadCronJob(loadedHost, identifier, autoBackupModal).then(job => {
		if (job) {
			automatedBackupsDisabledMessage.style.display = 'none';
			automatedBackupsEnabledMessage.style.display = 'flex';
			// parse command for max-backups
			if (job.command) {
				const m = job.command.match(/--max-backups=(\d+)/);
				if (m) autoBackupKeep.value = parseInt(m[1], 10) || 0;
			}
		}
		else {
			automatedBackupsDisabledMessage.style.display = 'flex';
			automatedBackupsEnabledMessage.style.display = 'none';
		}
	}).catch(e => {
		console.error('Error loading cron job:', e);
		showToast('error', 'Error loading automatic backup configuration.');
	})
}

async function saveAutomaticBackupConfig() {
	const keep = parseInt(autoBackupKeep.value, 10) || 0;
	const guid = loadedApplication;
	const identifier = `${loadedApplication}_backup`;
	const gameDir = (applicationData[guid] && applicationData[guid].hosts && applicationData[guid].hosts.filter(h => h.host === loadedHost)[0]) ? applicationData[guid].hosts.filter(h => h.host === loadedHost)[0].path : null;

	if (!gameDir) {
		showToast('error', 'Cannot determine game directory for this host.');
		return;
	}

	const schedule = parseCronSchedule(autoBackupModal);

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
					showToast('success', 'Automatic backups disabled.');
					autoBackupModal.classList.remove('show');
					loadAutomaticBackupConfig();
				} else {
					showToast('error', `Failed to disable automatic backups: ${response.error}`);
				}
			})
			.catch(() => showToast('error', 'Error disabling automatic backups'));
		return;
	}

	// Build command
	const command = `${gameDir}/manage.py --backup --max-backups=${keep}`;

	fetch(`/api/cron/${loadedHost}`, {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify({schedule, command, identifier})
	})
		.then(r => r.json())
		.then(response => {
			if (response.success) {
				showToast('success', 'Automatic backup scheduled.');
				autoBackupModal.classList.remove('show');
				loadAutomaticBackupConfig();
			} else {
				showToast('error', `Failed to save schedule: ${response.error}`);
			}
		})
		.catch(() => showToast('error', 'Error saving schedule'));
}

async function startUpload() {
	const files = fileInput.files;
	if (!files.length) return;

	showToast('info', 'Starting upload, please wait a moment...');

	for (let i = 0; i < files.length; i++) {
		const file = files[i];

		try {
			// Send raw file content
			const response = await fetch(`/api/file/${loadedHost}?path=${backupPath}/${file.name}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream'
				},
				body: file
			});

			const result = await response.json();

			if (!result.success) {
				showToast('error', `Error uploading ${file.name}: ${result.error}`);
			}
			else {
				showToast('success', `Successfully uploaded ${result.success}`);
				loadBackupsList();
			}
		} catch (error) {
			showToast('error', `Network error uploading ${file.name}: ${error.message}`);
		}
	}
}

// Upload file(s)
uploadBtn.addEventListener('click', () => {
	fileInput.click();
});
fileInput.addEventListener('change', (e) => {
	startUpload();
});

/**
 * Primary handler to load the application on page load
 */
window.addEventListener('DOMContentLoaded', () => {

	const {guid, host} = getPathParams('/application/backups/:guid/:host');

	Promise.all([
		loadApplication(guid),
		loadHost(host)
	])
		.then(() => {

			backupPath = applicationData[guid].hosts.filter(h => h.host === host)[0].path + '/backups';

			loadAutomaticBackupConfig();
			loadBackupsList();

			performBackupBtn.addEventListener('click', () => {
				backupModal.classList.add('show');
				backupModal.querySelector('.warning-message').style.display = 'flex';
				backupModal.querySelector('.terminal').style.display = 'none';
			});

			confirmBackupBtn.addEventListener('click', () => {
				const terminalOutput = backupModal.querySelector('.terminal');

				backupModal.querySelector('.warning-message').style.display = 'none';
				terminalOutput.textContent = 'Performing backup... Please wait.\n';
				terminalOutput.style.display = 'block';
				stream(
					`/api/application/backup/${loadedApplication}/${loadedHost}`,
					'POST',
					{'Content-Type': 'application/json'},
					null,
					(event, data) => {
						terminalOutputHelper(terminalOutput, event, data);
					})
					.then(() => {
						showToast('success', 'Backup completed successfully.');
						loadBackupsList();
					}).catch(() => {
						showToast('error', 'Backup process encountered an error. See terminal output for details.');
					});
			});

			confirmRestoreBtn.addEventListener('click', () => {
				const terminalOutput = restoreModal.querySelector('.terminal'),
					fileName = confirmRestoreBtn.dataset.file;

				restoreModal.querySelector('.warning-message').style.display = 'none';
				terminalOutput.textContent = `Restoring backup '${fileName}'... Please wait.\n`;
				terminalOutput.style.display = 'block';
				stream(
					`/api/application/backup/${loadedApplication}/${loadedHost}`,
					'PUT',
					{'Content-Type': 'application/json'},
					JSON.stringify({filename: fileName}),
					(event, data) => {
						terminalOutputHelper(terminalOutput, event, data);
					})
					.then(() => {
						showToast('success', 'Restore completed successfully.');
					}).catch(() => {
						showToast('error', 'Restore process encountered an error. See terminal output for details.');
					});
			});

			confirmDeleteBtn.addEventListener('click', () => {
				const filePath = confirmDeleteBtn.dataset.path;

				fetch(`/api/file/${loadedHost}?path=${filePath}`, {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json'
					}
				})
					.then(response => response.json())
					.then(data => {
						if (data.success) {
							showToast('success', `Backup '${filePath}' deleted successfully.`);
							deleteModal.classList.remove('show');
							loadBackupsList();
						} else {
							showToast('error', `Failed to delete backup: ${data.error}`);
						}
					})
					.catch(e => {
						showToast('error', `Error deleting backup: ${e.message}`);
					});
			});

			configureAutoBackupBtn.addEventListener('click', () => {
				autoBackupModal.classList.add('show');
			});

			saveAutoBackupBtn.addEventListener('click', () => {
				saveAutomaticBackupConfig();
			});
		}).catch(e => {
			console.error(e);
			document.querySelector('.content-body').innerHTML = '<div class="alert alert-danger" role="alert">Error loading application or host data.</div>';
		});
});
