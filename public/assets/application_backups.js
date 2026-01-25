const backupsList = document.getElementById('backupsList'),
	performBackupBtn = document.getElementById('performBackupBtn'),
	backupModal = document.getElementById('backupModal'),
	confirmBackupBtn = document.getElementById('confirmBackupBtn'),
	confirmRestoreBtn = document.getElementById('confirmRestoreBtn'),
	restoreModal = document.getElementById('restoreModal'),
	deleteBackupModal = document.getElementById('deleteBackupModal'),
	confirmDeleteBackupBtn = document.getElementById('confirmDeleteBackupBtn'),
	configureAutoBackupBtn = document.getElementById('configureAutoBackupBtn'),
	automatedBackupsDisabledMessage = document.getElementById('automatedBackupsDisabledMessage'),
	automatedBackupsEnabledMessage = document.getElementById('automatedBackupsEnabledMessage'),
	autoBackupModal = document.getElementById('autoBackupModal'),
	autoBackupSchedule = document.getElementById('autoBackupSchedule'),
	autoBackupKeep = document.getElementById('autoBackupKeep'),
	saveAutoBackupBtn = document.getElementById('saveAutoBackupBtn'),
	uploadBackupBtn = document.getElementById('uploadBackupBtn'),
	fileBackupInput = document.getElementById('fileBackupInput'),
	renameBackupModal = document.getElementById('renameBackupModal'),
	renameInput = document.getElementById('renameNewName'),
	confirmBackupRenameBtn = document.getElementById('confirmBackupRename');

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
		<div class="file-name">${fileData.name}</div>
		<div class="file-modified">${convertTimestampToDateTimeString(fileData.modified)}</div>
		<div class="file-size">${formatFileSize(fileData.size)}</div>
		<div class="file-actions button-group">
			<button class="action-rename">
				<i class="fas fa-pencil"></i>
				Rename
			</button>
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

	fileItem.querySelector('.action-rename').addEventListener('click', () => {
		let filename = fileData.name,
			extension = '';
		// Most files here will end in '.tar.gz', so trim that for the rename input
		if (filename.endsWith('.tar.gz')) {
			filename = filename.slice(0, -7);
			extension = '.tar.gz';
		} else if (filename.endsWith('.zip')) {
			filename = filename.slice(0, -4);
			extension = '.zip';
		}
		renameInput.value = filename;
		renameInput.dataset.extension = extension;
		renameInput.dataset.path = fileData.path;
		openModal(renameBackupModal);
	});
	fileItem.querySelector('.action-download').addEventListener('click', () => {
		window.open(`/api/file/${loadedHost}?path=${fileData.path}&download=1`, '_blank');
	});
	fileItem.querySelector('.action-restore').addEventListener('click', () => {
		confirmRestoreBtn.dataset.file = fileData.name;
		restoreModal.querySelector('.warning-message').style.display = 'flex';
		restoreModal.querySelector('.terminal').style.display = 'none';
		openModal(restoreModal);
	});
	fileItem.querySelector('.action-remove').addEventListener('click', () => {
		confirmDeleteBackupBtn.dataset.path = fileData.path;
		openModal(deleteBackupModal);
	});

	return fileItem;
}

async function performRename() {
	let newName = renameInput.value.trim(),
		oldName = renameInput.dataset.path,
		path = oldName.split('/');
	path = path.slice(0, path.length - 1).join('/');

	if (!newName) {
		alert('Please enter a new name');
		return;
	}

	// Do some basic sanitization
	newName = newName.replace(/[!/\\?%*:|"<> ]/g, '-');

	newName =  path + '/' + newName + renameInput.dataset.extension;

	if (newName === oldName) {
		closeModal(renameBackupModal);
		return;
	}

	try {
		const response = await fetch(`/api/file/${loadedHost}`, {
			method: 'MOVE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				oldPath: oldName,
				newPath: newName
			})
		});

		const result = await response.json();

		if (result.success) {
			showToast('success', 'Item renamed successfully');
			closeModal(renameModal);
			loadBackupsList();
		} else {
			showToast('error', `Error renaming item: ${result.error}`);
		}
	} catch (error) {
		showToast('error', `Network error: ${error.message}`);
	}
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
					closeModal(autoBackupModal);
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
				closeModal(autoBackupModal);
				loadAutomaticBackupConfig();
			} else {
				showToast('error', `Failed to save schedule: ${response.error}`);
			}
		})
		.catch(() => showToast('error', 'Error saving schedule'));
}

async function startUpload() {
	const files = fileBackupInput.files;
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

function loadBackups() {
	backupPath = loadedApplicationData.hosts.filter(h => h.host === loadedHost)[0].path + '/backups';

	loadAutomaticBackupConfig();
	loadBackupsList();
}


// Upload file(s)
uploadBackupBtn.addEventListener('click', () => {
	fileBackupInput.click();
});
fileBackupInput.addEventListener('change', (e) => {
	startUpload();
});

confirmBackupRenameBtn.addEventListener('click', () => {
	performRename();
});

performBackupBtn.addEventListener('click', () => {
	openModal(backupModal);
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

confirmDeleteBackupBtn.addEventListener('click', () => {
	const filePath = confirmDeleteBackupBtn.dataset.path;

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
				closeModal(deleteBackupModal);
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
	openModal(autoBackupModal);
});

saveAutoBackupBtn.addEventListener('click', () => {
	saveAutomaticBackupConfig();
});