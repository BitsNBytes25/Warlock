const backupsList = document.getElementById('backupsList'),
	performBackupBtn = document.getElementById('performBackupBtn'),
	confirmBackupBtn = document.getElementById('confirmBackupBtn'),
	restoreModal = document.getElementById('restoreModal'),
	configureAutoBackupBtn = document.getElementById('configureAutoBackupBtn'),
	automatedBackupsDisabledMessage = document.getElementById('automatedBackupsDisabledMessage'),
	automatedBackupsEnabledMessage = document.getElementById('automatedBackupsEnabledMessage'),
	autoBackupKeep = document.getElementById('autoBackupKeep'),
	uploadBackupBtn = document.getElementById('uploadBackupBtn');

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
		openDeleteFileModal(loadedHost, fileData.path, () => {loadBackupsList();});
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
				let counter = 0;
				backupsList.innerHTML = '';

				// Sort them by modified timestamp, descending
				data.files.sort((a, b) => b.modified - a.modified);

				data.files.forEach(fileData => {
					if (fileData.name.endsWith('.tar.gz')) {
						counter++;
						backupsList.appendChild(renderBackupFile(fileData));
					}
				});

				if (counter === 0) {
					backupsList.innerHTML = '<p class="warning-message">No backups exist for this service!</p>';
				}
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

function loadBackups() {
	// V2 of the API supports backup directories being defined per-service.
	backupPath = loadedServiceData.bak_dir || loadedApplicationData.hosts.filter(h => h.host === loadedHost)[0].path + '/backups';

	loadAutomaticBackupConfig();
	loadBackupsList();
}


// Upload file(s)
uploadBackupBtn.addEventListener('click', () => {
	openFileUploadModal(
		loadedHost,
		backupPath,
		() => {
			loadBackupsList();
		},
		{
			multiple: false,
			accept: '.tar.gz',
		}
	);
});

configureAutoBackupBtn.addEventListener('click', () => {
	openAutoBackupModal(loadedHost, loadedApplication, loadedService, () => {
		loadAutomaticBackupConfig();
	});
});

performBackupBtn.addEventListener('click', () => {
	openServiceBackupModal(loadedHost, loadedApplication, loadedService, () => {
		loadBackupsList();
	});
});
