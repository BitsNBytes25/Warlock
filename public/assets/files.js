const fileList = document.getElementById('fileList'),
	currentPathEl = document.getElementById('currentPath'),
	refreshBtn = document.getElementById('refreshBtn'),
	upBtn = document.getElementById('upBtn'),
	contextMenu = document.getElementById('contextMenu'),
	// Buttons used throughout this interface, they usually open a Modal.
	createFolderBtn = document.getElementById('createFolderBtn'),
	createFileBtn = document.getElementById('createFileBtn'),
	uploadBtn = document.getElementById('uploadBtn'),
	filesShowHiddenBtn = document.getElementById('filesShowHiddenBtn');

let contextMenuTarget = null;

/**
 * Show the UI when loading a file or directory
 *
 * Will also hide any preview/editing windows that may happen to be open.
 */
function showLoading() {
	fileList.innerHTML = '<div class="loading-spinner"></div>';

	refreshBtn.disabled = true;
	refreshBtn.innerHTML = '<i class="fas fa-spin fa-spinner"></i>';
}

/**
 * Hide the loading UI to allow an edit/view window to be displayed instead
 */
function hideLoading() {
	refreshBtn.disabled = false;
	refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
}

function showError(message) {
	fileList.innerHTML = `
		<div class="error-message">
			<i class="fas fa-exclamation-triangle"></i>
			${message}
		</div>
	`;
}

/**
 * Get the appropriate icon HTML for a given file mimetype
 *
 * @param {string} mimetype
 * @returns {string} Rendered HTML code
 */
function getFileIcon(mimetype) {
	// Exact mimetype matches
	const iconMap = {
		'inode/directory': 'fas fa-folder',
		'application/pdf': 'fas fa-file-pdf',
		'application/zip': 'fas fa-file-archive',
		'application/gzip': 'fas fa-file-archive',
		'application/x-gzip': 'fas fa-file-archive',
		'application/x-tar': 'fas fa-file-archive',
		'application/yaml': 'fas fa-file-lines',
		'text/x-script.python': 'fas fa-file-code',
		'text/x-shellscript': 'fas fa-file-code',
		'application/json': 'fas fa-file-lines',
		'application/java-archive': 'fab fa-java',
	};

	// Approximate / generic matches by group
	const typeGroupMap = {
		'text': 'fas fa-file-alt',
		'image': 'fas fa-file-image',
		'video': 'fas fa-file-video',
		'audio': 'fas fa-file-audio',
		'application': 'fas fa-file'
	};

	let icon = iconMap[mimetype] || null;
	if (!icon) {
		const typeGroup = mimetype.split('/')[0];
		icon = typeGroupMap[typeGroup] || 'fas fa-file';
	}

	return `<i class="${icon} file-icon file"></i>`;
}

/**
 * Translate a numeric mode (e.g., 755) into a string representation (e.g., rwxr-xr-x)
 *
 * The input is expected to decimal format of octal permissions.
 * This means that 755 is treated as octal 0755
 * and automatically converted to 493 in decimal for bitwise operations.
 *
 * @param {int} mode
 * @return {string} Pretty formatted permission string
 */
function getPermissions(mode) {
	// The mode is probably in decimal format of octal permissions, so convert it
	mode = parseInt(mode, 8);

	const perms = ['r', 'w', 'x'];
	let result = '';
	for (let i = 2; i >= 0; i--) {
		const digit = (mode >> (i * 3)) & 0b111;
		for (let j = 0; j < 3; j++) {
			result += (digit & (1 << (2 - j))) ? perms[j] : '-';
		}
	}
	return result;
}

async function loadDirectory(path) {
	showLoading();

	if (path) {
		currentPathEl.textContent = path;
	}
	else {
		// Allow the path to be loaded from the application state, (useful for just refreshing the file list)
		path = currentPathEl.textContent;
	}

	fetch(`/api/files/${loadedHost}?path=${path}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				displayFiles(data.files);
			}
			else {
				showError(`Failed to load directory: ${data.error}`);
			}
		})
		.finally(() => {
			hideLoading();
		});
}

function displayFiles(files) {
	if (!files || files.length === 0) {
		fileList.innerHTML = `
			<div style="text-align: center; color: #666; padding: 2rem;">
				<i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
				This directory is empty
			</div>
		`;
		return;
	}

	const sortedFiles = files.sort((a, b) => {
		// Directories first, then files, both alphabetically
		if (a.mimetype === 'inode/directory' && b.mimetype !== 'inode/directory') return -1;
		if (a.mimetype !== 'inode/directory' && b.mimetype === 'inode/directory') return 1;
		return a.name.localeCompare(b.name);
	});

	fileList.innerHTML = sortedFiles.map(file => {
		return `
			<div class="file-item" data-mimetype="${file.mimetype}" data-name="${file.name}" data-path="${file.path}" data-hidden="${file.name.startsWith('.')?1:0}">
				${getFileIcon(file.mimetype)}
				<div class="file-name">${file.name}</div>
				<div class="file-owner">${file.user}:${file.group}</div>
				<div class="file-permissions">${getPermissions(file.permissions)}</div>
				<div class="file-size">${file.size === null ? '-' : formatFileSize(file.size)}</div>
				<div class="file-modified">${convertTimestampToDateTimeString(file.modified)}</div>
				
				<button class="three-dot-btn" title="More options">
					<i class="fas fa-ellipsis-v"></i>
				</button>

				${file.symlink ? '<div class="file-symlink-note">' + file.path + '</div>' : ''}
			</div>
		`;
	}).join('');

	// Add click handlers
	document.querySelectorAll('.file-item').forEach(el => {
		el.addEventListener('click', e => {
			if (e.target.classList.contains('three-dot-btn') || e.target.closest('.three-dot-btn')) {
				// Three-dot button clicked
				showContextMenu(e);
				return;
			}

			e.preventDefault();
			let item = e.target.closest('.file-item');

			if (!item) {
				return;
			}

			if (item.dataset.mimetype === 'inode/directory') {
				loadDirectory(item.dataset.path);
			}
			else {
				openFileEditModal(loadedHost, item.dataset.path, () => {
					loadDirectory();
				});
			}
		});

		// Add right-click context menu
		el.addEventListener('contextmenu', showContextMenu);
	});
}

/**
 * Populate the context menu with relevant actions based on the file item
 *
 * @param fileItem
 */
function populateContextMenu(fileItem) {
	const archives = [
		'application/zip',
		'application/gzip',
		'application/x-gzip',
		'application/x-tar',
		'application/x-7z-compressed',
		'application/x-rar-compressed',
		'application/x-bzip2',
		'application/x-xz'
	];

	const texts = [
		'text/plain',
		'text/html',
		'text/css',
		'text/javascript',
		'application/json',
		'application/javascript',
		'application/xml',
		'application/yaml',
		'text/x-script.python',
		'application/x-httpd-php'
	];

	let mimetype = fileItem.dataset.mimetype || '',
		isArchive = archives.includes(mimetype),
		isDirectory = mimetype === 'inode/directory',
		isText = mimetype.startsWith('text/') || texts.includes(mimetype),
		btnOpen = contextMenu.querySelector('[data-action="open"]'),
		btnEdit = contextMenu.querySelector('[data-action="edit"]'),
		btnExtract = contextMenu.querySelector('[data-action="extract"]'),
		btnCompress = contextMenu.querySelector('[data-action="compress"]'),
		btnDownload = contextMenu.querySelector('[data-action="download"]');

	if (isDirectory) {
		btnEdit.style.display = 'none';
		btnOpen.style.display = 'flex';
		btnExtract.style.display = 'none';
		btnCompress.style.display = 'flex';
		btnDownload.style.display = 'none';
	}
	else if (isArchive) {
		btnEdit.style.display = 'none';
		btnOpen.style.display = 'none';
		btnExtract.style.display = 'flex';
		btnCompress.style.display = 'none';
		btnDownload.style.display = 'flex';
	}
	else if (isText) {
		btnEdit.style.display = 'flex';
		btnOpen.style.display = 'none';
		btnExtract.style.display = 'none';
		btnCompress.style.display = 'none';
		btnDownload.style.display = 'flex';
	}
	else {
		btnEdit.style.display = 'none';
		btnOpen.style.display = 'none';
		btnExtract.style.display = 'none';
		btnCompress.style.display = 'none';
		btnDownload.style.display = 'flex';
	}

	contextMenuTarget = fileItem;
}

/**
 * Show context menu for a file item
 * @param event
 */
function showContextMenu(event) {
	event.preventDefault();

	let row = event.target.closest('.file-item'),
		bounding = row.getBoundingClientRect(),
		newX = event.clientX - bounding.left,
		newY = fileList.offsetTop + row.offsetTop + row.offsetHeight,
		maxY = fileList.offsetTop + fileList.offsetHeight,
		maxX = fileList.offsetWidth;

	// Hide any previously-selected items first
	fileList.querySelectorAll('.file-item.active').forEach(item => {
		item.classList.remove('active');
	});

	populateContextMenu(row);
	row.classList.add('active');

	// Position the context menu at mouse/row position
	contextMenu.style.left = newX + 'px';
	contextMenu.style.top = newY + 'px';
	contextMenu.classList.add('show');

	// Ensure menu doesn't overflow outside the container
	if (newY + contextMenu.offsetHeight > maxY) {
		newY = maxY - contextMenu.offsetHeight;
		contextMenu.style.top = newY + 'px';
	}
	if (newX + contextMenu.offsetWidth > maxX) {
		newX = maxX - contextMenu.offsetWidth;
		contextMenu.style.left = newX + 'px';
	}
}

/**
 * Hide the context menu
 */
function hideContextMenu() {
	contextMenu.classList.remove('show');
	fileList.querySelectorAll('.file-item.active').forEach(item => {
		item.classList.remove('active');
	});
	contextMenuTarget = null;
}

function performDownload(e) {
	e.preventDefault();

	let filePath = null;
	if (e.target.dataset.path) {
		filePath = e.target.dataset.path;
	}
	else if(e.target.closest('[data-path]')) {
		filePath = e.target.closest('[data-path]').dataset.path;
	}
	else if (contextMenuTarget) {
		filePath = contextMenuTarget.dataset.path;
	}
	else {
		return;
	}

	window.open(`/api/file/${loadedHost}?path=${filePath}&download=1`, '_blank');
}

async function performExtract() {
	let path = contextMenuTarget.dataset.path;

	showToast('info', `Extracting ${path}, please wait a moment.`);

	fetch(`/api/file/extract/${loadedHost}?path=${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				showToast('success', result.message);
				loadDirectory(); // Refresh current directory
			}
			else {
				showToast('error', `Error extracting archive: ${result.error}`);
			}
		});
}

/////////// Event listeners

// Refresh button functionality
refreshBtn.addEventListener('click', () => {
	loadDirectory()
});

// Navigate up one directory
upBtn.addEventListener('click', () => {
	if (currentPathEl.textContent !== '/') {
		const parentPath = currentPathEl.textContent.split('/').slice(0, -1).join('/') || '/';
		loadDirectory(parentPath);
	}
});

// Create folder
createFolderBtn.addEventListener('click', () => {
	openCreateFolderModal(loadedHost, currentPathEl.textContent, () => {
		loadDirectory();
	});
});

// Create file
createFileBtn.addEventListener('click', () => {
	openCreateFileModal(loadedHost, currentPathEl.textContent, () => {
		loadDirectory();
	});
});

// Upload file(s)
uploadBtn.addEventListener('click', () => {
	openFileUploadModal(loadedHost, currentPathEl.textContent, () => {
		loadDirectory();
	});
});

// Show/hide hidden files
filesShowHiddenBtn.addEventListener('click', () => {
	if (fileList.classList.contains('show-hidden')) {
		fileList.classList.remove('show-hidden');
		filesShowHiddenBtn.querySelector('.hide-icon').style.display = 'none';
		filesShowHiddenBtn.querySelector('.show-icon').style.display = 'inline-block';
	}
	else {
		fileList.classList.add('show-hidden');
		filesShowHiddenBtn.querySelector('.hide-icon').style.display = 'inline-block';
		filesShowHiddenBtn.querySelector('.show-icon').style.display = 'none';
	}
});

// Context menu actions
contextMenu.addEventListener('click', e => {
	let btn = e.target.closest('button');
	if (!btn) {
		hideContextMenu();
		return;
	}

	let action = btn.dataset.action;
	if (!action) {
		hideContextMenu();
		return;
	}

	if (action === 'open') {
		loadDirectory(contextMenuTarget.dataset.path);
	}
	else if (action === 'edit') {
		openFileEditModal(loadedHost, contextMenuTarget.dataset.path, () => {
			loadDirectory();
		});
	}
	else if (action === 'extract') {
		performExtract();
	}
	else if (action === 'download') {
		performDownload(e);
	}
	else if (action === 'rename') {
		openRenameFileModal(loadedHost, contextMenuTarget.dataset.path, contextMenuTarget.dataset.name, () => {
			loadDirectory();
		});
	}
	else if (action === 'delete') {
		openDeleteFileModal(loadedHost, contextMenuTarget.dataset.path, () => {
			loadDirectory();
		});
	}
	else if (action === 'compress') {
		openCompressFolderModal(loadedHost, contextMenuTarget.dataset.path, () => {
			loadDirectory();
		});
	}

	hideContextMenu();
});

// Hide context menu on click outside
document.addEventListener('click', (e) => {
	if (!e.target.closest('#contextMenu') && !e.target.closest('.three-dot-btn')) {
		hideContextMenu();
	}
});
