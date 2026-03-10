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
	renameInput = document.getElementById('renameNewName');

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
		openRenameFileModal(
			loadedHost,
			fileData.path,
			fileData.name,
			() => {
				loadBackupsList();
			},
			{
				skipExtension: true,
				skipWarning: true,
			}
		);
	});
	fileItem.querySelector('.action-download').addEventListener('click', () => {
		window.open(`/api/file/${loadedHost}?path=${fileData.path}&download=1`, '_blank');
	});
	fileItem.querySelector('.action-restore').addEventListener('click', () => {
		openServiceRestoreModal(loadedHost, loadedApplication, loadedService, fileData.name);
	});
	fileItem.querySelector('.action-remove').addEventListener('click', () => {
		confirmDeleteBackupBtn.dataset.path = fileData.path;
		openModal(deleteBackupModal);
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
	const hostData = loadedApplicationData.hosts.filter(h => h.host === loadedHost)[0],
		appVersion = hostData.version;

	let identifier;
	if (appVersion >= 2) {
		identifier = `${loadedApplication}_${loadedService}_backup`;
	}
	else {
		identifier = `${loadedApplication}_backup`;
	}

	loadCronJob(loadedHost, identifier).then(job => {
		if (job) {
			automatedBackupsDisabledMessage.style.display = 'none';
			automatedBackupsEnabledMessage.style.display = 'flex';
		}
		else {
			automatedBackupsDisabledMessage.style.display = 'flex';
			automatedBackupsEnabledMessage.style.display = 'none';
		}
	}).catch(e => {
		console.error('Error loading cron job:', e);
		showToast('error', 'Error loading automatic backup configuration.');
	});
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
	// V2 of the API supports backup directories being defined per-service.
	backupPath = loadedServiceData.bak_dir || loadedApplicationData.hosts.filter(h => h.host === loadedHost)[0].path + '/backups';

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
	openAutoBackupModal(loadedHost, loadedApplication, loadedService, () => {
		loadAutomaticBackupConfig();
	});
});

performBackupBtn.addEventListener('click', () => {
	openServiceBackupModal(loadedHost, loadedApplication, loadedService, () => {
		loadBackups();
	});
});
/*
saveAutoBackupBtn.addEventListener('click', () => {
	saveAutomaticBackupConfig();
});
*/