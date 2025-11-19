let currentPath = '/home/steam';
let isLoading = false;

const fileList = document.getElementById('fileList');
const currentPathEl = document.getElementById('currentPath');
const refreshBtn = document.getElementById('refreshBtn');
const upBtn = document.getElementById('upBtn');
const filePreview = document.getElementById('filePreview');
const previewTitle = document.getElementById('previewTitle');
const previewContent = document.getElementById('previewContent');
const fileEditor = document.getElementById('fileEditor');
const editorTitle = document.getElementById('editorTitle');
const editorTextarea = document.getElementById('editorTextarea');
const editorInfo = document.getElementById('editorInfo');
const editorStats = document.getElementById('editorStats');
const saveBtn = document.getElementById('saveBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const host = window.location.pathname.substring(7);

let currentEditFile = null;

// Search functionality (optional - only if search element exists)
const fileSearch = document.getElementById('fileSearch');
const searchClear = document.getElementById('searchClear');
let searchTimeout = null;
let isSearching = false;
let searchResults = null;

// Initialize
currentPathEl.textContent = currentPath;

/**
 * Show the UI when loading a file or directory
 *
 * Will also hide any preview/editing windows that may happen to be open.
 */
function showLoading() {
	let viewerLoadingState = document.getElementById('viewerLoadingState'),
		viewerEmptyState = document.getElementById('viewerEmptyState'),
		filePreviewContent = document.getElementById('filePreviewContent'),
		fileEditorContent = document.getElementById('fileEditorContent');

	// Reset viewer state
	viewerLoadingState.style.display = 'flex';
	viewerEmptyState.style.display = 'none';
	filePreviewContent.style.display = 'none';
	fileEditorContent.style.display = 'none';

	isLoading = true;
	refreshBtn.disabled = true;
	refreshBtn.innerHTML = '<div class="loading-spinner"></div> Loading...';
}

/**
 * Hide the loading UI to allow an edit/view window to be displayed instead
 */
function hideLoading() {
	let viewerLoadingState = document.getElementById('viewerLoadingState');
	isLoading = false;
	refreshBtn.disabled = false;
	refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';

	viewerLoadingState.style.display = 'none';
}

function showError(message) {
	fileList.innerHTML = `
		<div class="error-message">
			<i class="fas fa-exclamation-triangle"></i>
			${message}
		</div>
	`;
}



async function performRecursiveSearch(query) {
	if (!query || query.length < 2) {
		// If search is cleared or too short, show current directory files
		if (searchResults) {
			loadDirectory(currentPath);
			searchResults = null;
		}
		return;
	}

	if (!fileSearch) return; // Skip if search element doesn't exist

	isSearching = true;
	fileSearch.disabled = true;

	// Show loading state
	fileList.innerHTML = `
                <div style="text-align: center; color: #0096ff; padding: 2rem; grid-column: 1 / -1;">
                    <div class="loading-spinner" style="display: inline-block; margin-bottom: 1rem;"></div>
                    <div>Searching in ${currentPath} and subdirectories...</div>
                </div>
            `;

	try {
		const response = await fetch('/search-files', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				path: currentPath,
				query: query
			})
		});

		const result = await response.json();

		if (result.success) {
			searchResults = result.results;
			displaySearchResults(result.results, query);
		} else {
			showError(`Search failed: ${result.error}`);
		}
	} catch (error) {
		showError(`Search error: ${error.message}`);
	} finally {
		isSearching = false;
		fileSearch.disabled = false;
	}
}

function displaySearchResults(results, query) {
	if (!results || results.length === 0) {
		fileList.innerHTML = `
                    <div style="text-align: center; color: #666; padding: 2rem; grid-column: 1 / -1;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; display: block; color: #0096ff;"></i>
                        <div style="font-size: 1.1rem; margin-bottom: 0.5rem;">No results found for "${query}"</div>
                        <div style="color: #94a3b8; font-size: 0.9rem;">Searched in ${currentPath} and all subdirectories</div>
                    </div>
                `;
		return;
	}

	// Show search results header
	const resultHeader = document.createElement('div');
	resultHeader.style.cssText = 'grid-column: 1 / -1; padding: 1rem; background: rgba(0, 150, 255, 0.1); border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(0, 150, 255, 0.3);';
	resultHeader.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <i class="fas fa-search" style="color: #0096ff;"></i>
                        <strong style="color: #0096ff;">${results.length}</strong> result${results.length !== 1 ? 's' : ''} found for "<strong>${query}</strong>"
                    </div>
                    <button onclick="clearSearch()" style="background: rgba(0, 150, 255, 0.2); border: 1px solid rgba(0, 150, 255, 0.3); color: #0096ff; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-family: 'Rajdhani', sans-serif; font-weight: 600;">
                        <i class="fas fa-times"></i> Clear Search
                    </button>
                </div>
            `;

	fileList.innerHTML = '';
	fileList.appendChild(resultHeader);

	// Sort results: directories first, then by name
	const sortedResults = results.sort((a, b) => {
		if (a.type === 'directory' && b.type !== 'directory') return -1;
		if (a.type !== 'directory' && b.type === 'directory') return 1;
		return a.name.localeCompare(b.name);
	});

	sortedResults.forEach(file => {
		const fileItem = document.createElement('div');
		fileItem.className = 'file-item';
		fileItem.dataset.type = file.type;
		fileItem.dataset.name = file.name;
		fileItem.dataset.path = file.path;

		// Get relative path from current directory
		const relativePath = file.path.replace(currentPath, '').replace(/^\//, '') || file.name;

		const isSymlink = file.type === 'symlink';

		fileItem.innerHTML = `
                    ${getFileIcon(file.type, file.name, file.symlinkTarget)}
                    <div class="file-name" style="${isSymlink ? 'color: #00d4ff;' : ''}">
                        <div>${file.name}</div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.2rem;">
                            <i class="fas fa-folder" style="font-size: 0.7rem;"></i> ${relativePath}
                        </div>
                    </div>
                    <div class="file-size">${file.type === 'directory' || file.type === 'symlink' ? '-' : formatFileSize(file.size || 0)}</div>
                    <div class="file-permissions">${file.permissions || '-'}</div>
                `;

		fileItem.addEventListener('click', () => {
			if (file.type === 'directory') {
				loadDirectory(file.path);
			} else if (file.type === 'symlink' || file.type === 'file') {
				if (!event.target.closest('.action-btn')) {
					previewFile(file.path, file.name);
				}
			}
		});

		fileList.appendChild(fileItem);
	});
}

function clearSearch() {
	if (fileSearch) {
		fileSearch.value = '';
		searchResults = null;
		loadDirectory(currentPath);
	}
}

// Set up search event listeners only if search element exists
if (fileSearch && searchClear) {
	// Debounced search - wait 500ms after typing stops
	fileSearch.addEventListener('input', () => {
		const query = fileSearch.value.trim();

		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		if (query.length === 0) {
			clearSearch();
			return;
		}

		if (query.length < 2) {
			return; // Don't search for single characters
		}

		searchTimeout = setTimeout(() => {
			performRecursiveSearch(query);
		}, 500);
	});

	searchClear.addEventListener('click', () => {
		clearSearch();
		fileSearch.focus();
	});

	fileSearch.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			clearSearch();
			fileSearch.blur();
		} else if (e.key === 'Enter') {
			// Trigger search immediately on Enter
			if (searchTimeout) {
				clearTimeout(searchTimeout);
			}
			performRecursiveSearch(fileSearch.value.trim());
		}
	});
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
		'application/x-gzip': 'fas fa-file-archive',
		'application/x-tar': 'fas fa-file-archive'
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

/**
 * Convert a GMT timestamp to a local date string
 *
 * @param {int} unixTime
 * @returns {string}
 */
function getTimestamp(unixTime) {
	const date = new Date(unixTime * 1000);
	return date.toLocaleString();
}

async function loadDirectory(path) {
	closeViewer();
	showLoading();
	currentPath = path;
	currentPathEl.textContent = path;

	// Clear search when changing directories (if search exists)
	if (window.fileSearch) {
		fileSearch.value = '';
		searchResults = null;
	}

	window.history.pushState(null, '', window.location.pathname + '?path=' + path);

	fetch(`/api/files/${host}?path=${path}`, {
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
			<div class="file-item" data-mimetype="${file.mimetype}" data-name="${file.name}" data-path="${file.path}">
				${getFileIcon(file.mimetype)}
				<div class="file-name">${file.name}</div>
				<div class="file-owner">${file.user}:${file.group}</div>
				<div class="file-permissions">${getPermissions(file.permissions)}</div>
				<div class="file-size">${file.size === null ? '-' : formatFileSize(file.size)}</div>
				<div class="file-modified">${getTimestamp(file.modified)}</div>
				
				<button class="three-dot-btn" onclick="showThreeDotMenu('${file.path}', '${file.name}', ${file.type === 'directory'}, event)" title="More options">
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
				// Three-dot button clicked, so ignore row click
				return;
			}

			e.preventDefault();
			let item = e.target.classList.contains('file-item') ? e.target : e.target.closest('.file-item'),
				name = item.dataset.name,
				path = item.dataset.path,
				type = item.dataset.type;

			if (type === 'directory') {
				loadDirectory(path);
			}
			else {
				openFile(path, name);
			}
		});

		// Add right-click context menu
		el.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			showContextMenu(e, el.dataset.path, el.dataset.name, el.dataset.type === 'directory');
		});
	});
}

async function openFile(filePath, fileName) {
	closeViewer();
	showLoading();

	fetch(`/api/file/${host}?path=${filePath}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
			console.debug(result);

			if (result.success) {
				if (result.encoding === 'raw') {
					editFile(result);
				}
				else if (result.mimetype === 'inode/directory') {
					loadDirectory(filePath);
				}
				else {
					previewFile(result);
				}
			}
		});
}

/**
 * Display a file preview
 * @param {FileData} fileData
 */
function previewFile(fileData) {
	const viewerTitle = document.getElementById('viewerTitle');
	const viewerSearchBar = document.getElementById('viewerSearchBar');
	const viewerActions = document.getElementById('viewerActions');
	const viewerEmptyState = document.getElementById('viewerEmptyState');
	const filePreviewContent = document.getElementById('filePreviewContent');
	const fileEditorContent = document.getElementById('fileEditorContent');
	const previewContent = document.getElementById('previewContent');

	// Hide empty state and editor, show preview
	hideLoading();
	viewerEmptyState.style.display = 'none';
	fileEditorContent.style.display = 'none';
	filePreviewContent.style.display = 'block';

	// Update title and show search bar (hide actions for preview)
	viewerTitle.innerHTML = `<i class="fas fa-file"></i> ${fileData.name}`;
	viewerSearchBar.style.display = 'none';
	viewerActions.style.display = 'none';

	document.getElementById('downloadFileBtn').dataset.path = fileData.path;

	if (fileData.encoding === 'base64' && fileData.mimetype.startsWith('image/')) {
		const imgSrc = `data:${fileData.mimetype};base64,${fileData.content}`;
		previewContent.innerHTML = `
			<div style="text-align: center; padding: 1rem;">
				<img src="${imgSrc}" 
					 alt="${fileData.name}" 
					 style="max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);" />
				<div style="margin-top: 1rem; color: #94a3b8; font-size: 0.9rem;">
					${fileData.name} - ${formatFileSize(fileData.size)}
				</div>
			</div>
		`;
	}
	else if (fileData.encoding === 'base64' && fileData.mimetype.startsWith('video/')) {
		const videoSrc = `data:${fileData.mimetype};base64,${fileData.content}`;
		previewContent.innerHTML = `
			<div style="text-align: center; padding: 1rem;">
				<video controls style="max-width: 100%; max-height: calc(100vh - 300px); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
					<source src="${videoSrc}" type="${fileData.mimetype}">
					Your browser does not support the video tag.
				</video>
				<div style="margin-top: 1rem; color: #94a3b8; font-size: 0.9rem;">
					${fileData.name} - ${formatFileSize(fileData.size)}
				</div>
			</div>
		`;
	}
	else {
		previewContent.innerHTML = `<div style="text-align: center; padding: 1rem;">
		${getFileIcon(fileData.mimetype)}<br/>
		${fileData.name} - ${formatFileSize(fileData.size)}
</div>`;
	}

}

/**
 * Open a file for editing
 *
 * @param {FileData} fileData
 */
function editFile(fileData) {
	console.log(fileData);
	currentEditFile = { path: fileData.path, name: fileData.name };

	const fileViewerCard = document.querySelector('.file-viewer-card'),
		viewerTitle = document.getElementById('viewerTitle'),
		viewerSearchBar = document.getElementById('viewerSearchBar'),
		viewerActions = document.getElementById('viewerActions'),
		viewerEmptyState = document.getElementById('viewerEmptyState'),
		filePreviewContent = document.getElementById('filePreviewContent'),
		fileEditorContent = document.getElementById('fileEditorContent'),
		editorTextarea = document.getElementById('editorTextarea'),
		editorInfo = document.getElementById('editorInfo'),
		saveFileBtn = document.getElementById('saveFileBtn'),
		viewerSearchPrev = document.getElementById('viewerSearchPrev'),
		viewerSearchNext = document.getElementById('viewerSearchNext');

	// Hide empty state and preview, show editor
	hideLoading();
	viewerEmptyState.style.display = 'none';
	filePreviewContent.style.display = 'none';
	fileEditorContent.style.display = 'flex';

	// Update title and show search bar and actions
	viewerTitle.innerHTML = `<i class="fas fa-edit"></i> ${currentEditFile.name}`;
	viewerSearchBar.style.display = 'flex';
	viewerActions.style.display = 'flex';

	editorTextarea.value = fileData.content;
	editorTextarea.disabled = false;
	saveFileBtn.disabled = false;
	viewerSearchPrev.classList.add('disabled');
	viewerSearchNext.classList.add('disabled');
	editorInfo.textContent = 'Ready to edit';
	updateEditorStats();
}

function updateEditorStats() {
	const editorTextarea = document.getElementById('editorTextarea');
	const editorStats = document.getElementById('editorStats');
	const content = editorTextarea.value;
	const lines = content.split('\n').length;
	const chars = content.length;
	const words = content.trim() ? content.trim().split(/\s+/).length : 0;

	editorStats.textContent = `${lines} lines, ${words} words, ${chars} characters`;
}

async function saveFile() {
	if (!currentEditFile) return;

	const saveFileBtn = document.getElementById('saveFileBtn');
	const editorInfo = document.getElementById('editorInfo');
	const editorTextarea = document.getElementById('editorTextarea');

	saveFileBtn.disabled = true;
	saveFileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
	editorInfo.textContent = 'Saving file...';

	try {
		const response = await fetch(`/api/file/${host}?path=${currentEditFile.path}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				content: editorTextarea.value
			})
		});

		const result = await response.json();

		if (result.success) {
			editorInfo.innerHTML = '<span style="color: #059669;"><i class="fas fa-check"></i> File saved successfully!</span>';

			// Show success message briefly
			setTimeout(() => {
				editorInfo.textContent = 'Ready to edit';
			}, 3000);
		} else {
			editorInfo.innerHTML = `<span style="color: #dc2626;"><i class="fas fa-exclamation-triangle"></i> Save failed: ${result.error}</span>`;
		}
	} catch (error) {
		editorInfo.innerHTML = `<span style="color: #dc2626;"><i class="fas fa-exclamation-triangle"></i> Network error: ${error.message}</span>`;
	} finally {
		saveFileBtn.disabled = false;
		saveFileBtn.innerHTML = '<i class="fas fa-save"></i> Save';
	}
}

function closeViewer() {
	const fileViewerCard = document.querySelector('.file-viewer-card');
	const viewerTitle = document.getElementById('viewerTitle');
	const viewerSearchBar = document.getElementById('viewerSearchBar');
	const viewerActions = document.getElementById('viewerActions');
	const viewerEmptyState = document.getElementById('viewerEmptyState');
	const filePreviewContent = document.getElementById('filePreviewContent');
	const fileEditorContent = document.getElementById('fileEditorContent');

	// Hide all viewer content and show empty state
	filePreviewContent.style.display = 'none';
	fileEditorContent.style.display = 'none';
	viewerEmptyState.style.display = 'flex';
	viewerSearchBar.style.display = 'none';
	viewerActions.style.display = 'none';

	// Reset title
	viewerTitle.innerHTML = '<i class="fas fa-file"></i> File Viewer';

	currentEditFile = null;
}

// Event listeners
refreshBtn.addEventListener('click', () => loadDirectory(currentPath));

upBtn.addEventListener('click', () => {
	if (currentPath !== '/') {
		const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
		loadDirectory(parentPath);
	}
});

document.querySelectorAll('.quick-path-item').forEach(item => {
	item.addEventListener('click', () => {
		const path = item.dataset.path;
		loadDirectory(path);
	});
});

// Viewer event listeners
document.getElementById('saveFileBtn').addEventListener('click', saveFile);

// Editor textarea event listener for stats
document.getElementById('editorTextarea').addEventListener('input', updateEditorStats);

// Modal elements
const createFolderBtn = document.getElementById('createFolderBtn');
const createFileBtn = document.getElementById('createFileBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');

const createFolderModal = document.getElementById('createFolderModal');
const createFileModal = document.getElementById('createFileModal');
const uploadModal = document.getElementById('uploadModal');

// Modal event listeners
createFolderBtn.addEventListener('click', () => {
	document.getElementById('folderName').value = '';
	createFolderModal.style.display = 'flex';
	document.getElementById('folderName').focus();
});

createFileBtn.addEventListener('click', () => {
	document.getElementById('fileName').value = '';
	document.getElementById('fileContent').value = '';
	createFileModal.style.display = 'flex';
	document.getElementById('fileName').focus();
});

uploadBtn.addEventListener('click', () => {
	fileInput.click();
});

fileInput.addEventListener('change', (e) => {
	if (e.target.files.length > 0) {
		showUploadModal(e.target.files);
	}
});

// Modal close handlers
document.getElementById('closeFolderModal').addEventListener('click', () => {
	createFolderModal.style.display = 'none';
});

document.getElementById('closeFileModal').addEventListener('click', () => {
	createFileModal.style.display = 'none';
});

document.getElementById('closeUploadModal').addEventListener('click', () => {
	uploadModal.style.display = 'none';
});

document.getElementById('cancelCreateFolder').addEventListener('click', () => {
	createFolderModal.style.display = 'none';
});

document.getElementById('cancelCreateFile').addEventListener('click', () => {
	createFileModal.style.display = 'none';
});

document.getElementById('cancelUpload').addEventListener('click', () => {
	uploadModal.style.display = 'none';
});

document.getElementById('cancelDelete').addEventListener('click', () => {
	document.getElementById('deleteConfirmModal').style.display = 'none';
	deleteItemData = null;
});

document.getElementById('closeDeleteModal').addEventListener('click', () => {
	document.getElementById('deleteConfirmModal').style.display = 'none';
	deleteItemData = null;
});

document.getElementById('cancelRename').addEventListener('click', () => {
	document.getElementById('renameModal').style.display = 'none';
	renameItemData = null;
});

document.getElementById('closeRenameModal').addEventListener('click', () => {
	document.getElementById('renameModal').style.display = 'none';
	renameItemData = null;
});


// Context menu handlers
document.getElementById('contextRename').addEventListener('click', showRenameModal);
document.getElementById('contextDelete').addEventListener('click', () => {
	if (contextMenuData) {
		hideContextMenu();
		confirmDelete(contextMenuData.path, contextMenuData.name, contextMenuData.isDirectory, null);
	}
});

// Hide context menu on click outside
document.addEventListener('click', (e) => {
	if (!e.target.closest('#contextMenu') && !e.target.closest('.three-dot-btn')) {
		hideContextMenu();
	}
});

// Confirm handlers
document.getElementById('confirmCreateFolder').addEventListener('click', createFolder);
document.getElementById('confirmCreateFile').addEventListener('click', createFile);
document.getElementById('confirmUpload').addEventListener('click', startUpload);
document.getElementById('confirmDelete').addEventListener('click', performDelete);
document.getElementById('confirmRename').addEventListener('click', performRename);
document.getElementById('downloadFileBtn').addEventListener('click', performDownload);

// Modal overlay close
document.addEventListener('click', (e) => {
	if (e.target.classList.contains('modal-overlay')) {
		e.target.parentElement.style.display = 'none';
	}
});

// New functionality functions
async function createFolder() {
	const folderName = document.getElementById('folderName').value.trim();
	if (!folderName) {
		alert('Please enter a folder name');
		return;
	}

	fetch(`/api/file/${host}?path=${currentPath}&name=${folderName}&isdir=1`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	}).then(response => response.json())
		.then(result => {
			if (result.success) {
				createFolderModal.style.display = 'none';
				loadDirectory(currentPath); // Refresh current directory
			} else {
				alert(`Error creating folder: ${result.error}`);
			}
		})
		.catch(error => {
			alert(`Network error: ${error.message}`);
		});
}

/**
 * Handler to create a new file, optionally with or without content.
 *
 * @returns {Promise<void>}
 */
async function createFile() {
	const fileName = document.getElementById('fileName').value.trim();
	const fileContent = document.getElementById('fileContent').value;

	fetch(`/api/file/${host}?path=${currentPath}&name=${fileName}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content: fileContent })
	})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				createFileModal.style.display = 'none';
				loadDirectory(currentPath); // Refresh current directory
			}
			else {
				alert(`Error creating file: ${result.error}`);
			}
		})
		.catch(error => {
			alert(`Network error: ${error.message}`);
		});
}

// Delete confirmation
let deleteItemData = null;

function confirmDelete(itemPath, itemName, isDirectory, event) {
	if (event) event.stopPropagation();

	deleteItemData = { path: itemPath, name: itemName, isDirectory };

	const deleteModal = document.getElementById('deleteConfirmModal');
	const deleteItemInfo = document.getElementById('deleteItemInfo');

	// Show item info
	deleteItemInfo.innerHTML = `
		<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
			<i class="fas fa-${isDirectory ? 'folder' : 'file'}" style="color: #0096ff;"></i>
			<strong>${itemName}</strong>
		</div>
		<div style="font-size: 0.85rem; color: #64748b;">
			Path: ${itemPath}
		</div>
		<div style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;">
			Type: ${isDirectory ? 'Folder (Recursive Delete)' : 'File'}
		</div>
	`;

	deleteModal.style.display = 'flex';
}

async function performDelete() {
	if (!deleteItemData) return;

	document.getElementById('deleteConfirmModal').style.display = 'none';

	fetch(`/api/file/${host}?path=${deleteItemData.path}`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
			console.debug(result);
			deleteItemData = null;

			if (result.success) {
				loadDirectory(currentPath); // Refresh current directory
			}
			else {
				alert(`Error deleting item: ${result.error}`);
			}
		});
}

// Context menu and three-dot menu functionality
let contextMenuData = null;

function showContextMenu(event, itemPath, itemName, isDirectory) {
	const contextMenu = document.getElementById('contextMenu');
	contextMenuData = { path: itemPath, name: itemName, isDirectory };

	// Position the context menu at mouse position
	contextMenu.style.left = event.pageX + 'px';
	contextMenu.style.top = event.pageY + 'px';
	contextMenu.classList.add('show');
}

function showThreeDotMenu(itemPath, itemName, isDirectory, event) {
	if (event) event.stopPropagation();

	const contextMenu = document.getElementById('contextMenu');
	contextMenuData = { path: itemPath, name: itemName, isDirectory };

	// Position the context menu near the three-dot button
	const rect = event.target.closest('.three-dot-btn').getBoundingClientRect();
	contextMenu.style.left = (rect.left - 150) + 'px';
	contextMenu.style.top = (rect.bottom + 5) + 'px';
	contextMenu.classList.add('show');
}

function hideContextMenu() {
	const contextMenu = document.getElementById('contextMenu');
	contextMenu.classList.remove('show');
}

// Rename functionality
let renameItemData = null;

function showRenameModal() {
	if (!contextMenuData) return;

	renameItemData = contextMenuData;
	hideContextMenu();

	const renameModal = document.getElementById('renameModal');
	const renameNewName = document.getElementById('renameNewName');

	renameNewName.value = renameItemData.name;

	renameModal.style.display = 'flex';

	// Focus and select the input
	setTimeout(() => {
		renameNewName.focus();
		renameNewName.select();
	}, 100);
}

function performDownload(e) {
	e.preventDefault();
	let filePath = null;
	if (e.target.dataset.path) {
		filePath = e.target.dataset.path;
	}
	else {
		filePath = e.target.closest('[data-path]').dataset.path;
	}

	window.open(`/api/file/${host}?path=${filePath}&download=1`, '_blank');
}

async function performRename() {
	if (!renameItemData) return;

	const newName = document.getElementById('renameNewName').value.trim();

	if (!newName) {
		alert('Please enter a new name');
		return;
	}

	if (newName === renameItemData.name) {
		document.getElementById('renameModal').style.display = 'none';
		return;
	}

	const oldPath = renameItemData.path;
	const pathParts = oldPath.split('/');
	pathParts[pathParts.length - 1] = newName;
	const newPath = pathParts.join('/');

	try {
		const response = await fetch('/rename-item', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				oldPath: oldPath,
				newPath: newPath,
				isDirectory: renameItemData.isDirectory
			})
		});

		const result = await response.json();

		if (result.success) {
			document.getElementById('renameModal').style.display = 'none';
			renameItemData = null;
			loadDirectory(currentPath); // Refresh current directory
		} else {
			alert(`Error renaming item: ${result.error}`);
		}
	} catch (error) {
		alert(`Network error: ${error.message}`);
	}
}

function showUploadModal(files) {
	const fileList = document.getElementById('uploadFileList');
	fileList.innerHTML = '';

	Array.from(files).forEach(file => {
		const fileItem = document.createElement('div');
		fileItem.className = 'upload-file-item';
		fileItem.innerHTML = `
                    <span class="upload-file-name">${file.name}</span>
                    <span class="upload-file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                `;
		fileList.appendChild(fileItem);
	});

	document.querySelector('.upload-status').textContent = `Ready to upload ${files.length} file(s)`;
	uploadModal.style.display = 'flex';
}

async function startUpload() {
	const files = fileInput.files;
	if (!files.length) return;

	const progressBar = document.querySelector('.progress-bar');
	const progressFill = document.querySelector('.progress-fill');
	const uploadStatus = document.querySelector('.upload-status');

	progressBar.style.display = 'block';

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		uploadStatus.textContent = `Uploading ${file.name}... (${i + 1}/${files.length})`;

		try {
			// Send raw file content
			const response = await fetch(`/api/file/${host}?path=${currentPath}/${file.name}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream'
				},
				body: file
			});

			const result = await response.json();

			if (!result.success) {
				alert(`Error uploading ${file.name}: ${result.error}`);
				continue;
			}
		} catch (error) {
			alert(`Network error uploading ${file.name}: ${error.message}`);
			continue;
		}

		const progress = ((i + 1) / files.length) * 100;
		progressFill.style.width = progress + '%';
	}

	uploadStatus.textContent = 'Upload complete!';
	setTimeout(() => {
		uploadModal.style.display = 'none';
		loadDirectory(currentPath); // Refresh directory
		fileInput.value = ''; // Reset file input
	}, 1500);
}

// Close preview when clicking outside
/*document.addEventListener('click', (e) => {
	if (!filePreview.contains(e.target) && !e.target.closest('.file-item')) {
		filePreview.style.display = 'none';
	}
	if (!fileEditor.contains(e.target) && !e.target.closest('.file-item')) {
		// Don't auto-close editor to prevent accidental loss of changes
	}
});*/

// Search functionality for unified viewer
let viewerMatches = [];
let viewerCurrentMatch = -1;

function performViewerSearchEvent(e) {
	const searchTerm = e.target.value,
		previewContent = document.getElementById('previewContent'),
		editorTextarea = document.getElementById('editorTextarea'),
		filePreviewContent = document.getElementById('filePreviewContent'),
		fileEditorContent = document.getElementById('fileEditorContent'),
		// Determine if we're searching in preview or editor
		isPreviewMode = filePreviewContent.style.display !== 'none',
		fileSearchNext = document.getElementById('viewerSearchNext'),
		fileSearchPrev = document.getElementById('viewerSearchPrev'),
		content = isPreviewMode ? previewContent : editorTextarea;

	if (!searchTerm) {
		// Clear highlights
		if (isPreviewMode && previewContent.dataset.originalContent) {
			previewContent.innerHTML = previewContent.dataset.originalContent;
		}
		document.getElementById('viewerSearchCount').textContent = '';
		fileSearchNext.classList.add('disabled');
		fileSearchPrev.classList.add('disabled');
		viewerMatches = [];
		viewerCurrentMatch = -1;
		return;
	}

	if (isPreviewMode) {
		// Search in preview content
		if (!previewContent.dataset.originalContent) {
			previewContent.dataset.originalContent = previewContent.textContent;
		}

		const textContent = previewContent.dataset.originalContent;
		const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
		const matches = [...textContent.matchAll(regex)];
		viewerMatches = matches.map(m => m.index);

		if (viewerMatches.length === 0) {
			previewContent.textContent = textContent;
			document.getElementById('viewerSearchCount').textContent = 'No results';
			return;
		}

		// Highlight matches
		let highlightedText = textContent;
		const parts = [];
		let lastIndex = 0;

		matches.forEach((match, i) => {
			parts.push(textContent.substring(lastIndex, match.index));
			parts.push(`<mark data-match="${i}" style="background-color: #fbbf24; color: #000; padding: 0 2px;">${match[0]}</mark>`);
			lastIndex = match.index + match[0].length;
		});
		parts.push(textContent.substring(lastIndex));

		previewContent.innerHTML = parts.join('');
		fileSearchNext.classList.remove('disabled');
		fileSearchPrev.classList.remove('disabled');
		viewerCurrentMatch = 0;
		updateViewerSearchHighlight();
	} else {
		// Search in editor textarea
		const textContent = editorTextarea.value;
		const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
		const matches = [...textContent.matchAll(regex)];
		viewerMatches = matches.map(m => m.index);

		if (viewerMatches.length === 0) {
			document.getElementById('viewerSearchCount').textContent = 'No results';
			return;
		}

		viewerCurrentMatch = 0;
		fileSearchNext.classList.remove('disabled');
		fileSearchPrev.classList.remove('disabled');
		updateViewerSearchHighlight();
	}
}

document.getElementById('viewerSearch').addEventListener('blur', performViewerSearchEvent);
document.getElementById('viewerSearch').addEventListener('keyup', e => {
	if (e.key === 'Enter') {
		performViewerSearchEvent(e);
	}
	else if (e.key === 'Escape') {
		e.target.value = '';
		performViewerSearchEvent(e);
	}
});

document.getElementById('viewerSearchNext').addEventListener('click', () => {
	if (viewerMatches.length === 0) return;
	viewerCurrentMatch = (viewerCurrentMatch + 1) % viewerMatches.length;
	updateViewerSearchHighlight();
});

document.getElementById('viewerSearchPrev').addEventListener('click', () => {
	if (viewerMatches.length === 0) return;
	viewerCurrentMatch = (viewerCurrentMatch - 1 + viewerMatches.length) % viewerMatches.length;
	updateViewerSearchHighlight();
});

function updateViewerSearchHighlight() {
	const previewContent = document.getElementById('previewContent');
	const editorTextarea = document.getElementById('editorTextarea');
	const filePreviewContent = document.getElementById('filePreviewContent');
	const isPreviewMode = filePreviewContent.style.display !== 'none';

	document.getElementById('viewerSearchCount').textContent = `${viewerCurrentMatch + 1} of ${viewerMatches.length}`;

	if (isPreviewMode) {
		// Update highlighting in preview
		const marks = previewContent.querySelectorAll('mark');
		marks.forEach((mark, i) => {
			if (i === viewerCurrentMatch) {
				mark.style.backgroundColor = '#0096ff';
				mark.style.color = '#fff';
				mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
			} else {
				mark.style.backgroundColor = '#fbbf24';
				mark.style.color = '#000';
			}
		});
	} else {
		// Highlight in editor textarea
		const searchInput = document.getElementById('viewerSearch');
		const searchTerm = searchInput.value;
		const matchIndex = viewerMatches[viewerCurrentMatch];

		editorTextarea.focus();
		editorTextarea.setSelectionRange(matchIndex, matchIndex + searchTerm.length);

		// Scroll to selection
		const lineHeight = parseFloat(getComputedStyle(editorTextarea).lineHeight);
		const lines = editorTextarea.value.substr(0, matchIndex).split('\n').length;
		editorTextarea.scrollTop = (lines - 1) * lineHeight - editorTextarea.clientHeight / 2;
	}
}

// Keyboard shortcuts for search
document.getElementById('viewerSearch').addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		if (e.shiftKey) {
			document.getElementById('viewerSearchPrev').click();
		} else {
			document.getElementById('viewerSearchNext').click();
		}
	} else if (e.key === 'Escape') {
		e.target.value = '';
		e.target.dispatchEvent(new Event('input'));
	}
});

// Resizer functionality
const resizer = document.querySelector('.resizer');
const browserCard = document.querySelector('.browser-card');
const fileViewerCard = document.querySelector('.file-viewer-card');
const filesLayout = document.querySelector('.files-layout');

let isResizing = false;
let startX = 0;
let startBrowserWidth = 0;

// Load saved panel sizes from localStorage
const savedBrowserWidth = localStorage.getItem('browserPanelWidth');
if (savedBrowserWidth) {
	browserCard.style.flexBasis = savedBrowserWidth;
	browserCard.style.flexGrow = '0';
	browserCard.style.flexShrink = '0';
}

resizer.addEventListener('mousedown', (e) => {
	isResizing = true;
	startX = e.clientX;
	startBrowserWidth = browserCard.offsetWidth;

	// Add visual feedback
	resizer.style.background = 'rgba(0, 150, 255, 0.4)';
	document.body.style.cursor = 'col-resize';
	document.body.style.userSelect = 'none';

	e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
	if (!isResizing) return;

	const delta = e.clientX - startX;
	const newBrowserWidth = startBrowserWidth + delta;
	const containerWidth = filesLayout.offsetWidth;
	const minWidth = 300;
	const maxWidth = containerWidth - 300 - 5; // 300px for viewer, 5px for resizer

	// Constrain width
	const constrainedWidth = Math.max(minWidth, Math.min(newBrowserWidth, maxWidth));

	// Set flex-basis instead of width for better flex behavior
	browserCard.style.flexBasis = constrainedWidth + 'px';
	browserCard.style.flexGrow = '0';
	browserCard.style.flexShrink = '0';

	// File viewer will automatically take remaining space
	fileViewerCard.style.flexBasis = 'auto';
	fileViewerCard.style.flexGrow = '1';
	fileViewerCard.style.flexShrink = '1';

	e.preventDefault();
});

document.addEventListener('mouseup', (e) => {
	if (isResizing) {
		isResizing = false;

		// Remove visual feedback
		resizer.style.background = '';
		document.body.style.cursor = '';
		document.body.style.userSelect = '';

		// Save panel size to localStorage
		localStorage.setItem('browserPanelWidth', browserCard.style.flexBasis);
	}
});

// Fetch and add application paths to quick paths
async function loadApplicationPaths() {
	fetchApplications()
		.then(applications => {
			const quickPathsContainer = document.querySelector('.quick-paths');

			// Add a separator
			const separator = document.createElement('div');
			separator.style.cssText = 'border-top: 1px solid rgba(0, 150, 255, 0.2); margin: 1rem 0; padding-top: 1rem;';
			separator.innerHTML = '<h4><i class="fas fa-cube"></i> Games</h4>';
			quickPathsContainer.appendChild(separator);

			for (const [guid, app] of Object.entries(applications)) {
				app.hosts.forEach(hostData => {
					if (hostData.host === host) {
						// Extract the last folder name from the path
						const icon = renderAppIcon(guid);

						const quickPathItem = document.createElement('div');
						quickPathItem.className = 'quick-path-item';
						quickPathItem.dataset.path = hostData.path;
						quickPathItem.innerHTML = `
                            ${icon}
                            ${app.title}
                        `;
						quickPathItem.addEventListener('click', () => {
							loadDirectory(hostData.path);
						});
						quickPathsContainer.appendChild(quickPathItem);
					}
				});
			}
		});
}

// Check for path parameter in URL
const urlParams = new URLSearchParams(window.location.search);
const pathParam = urlParams.get('path');

if (pathParam) {
	// If path parameter exists, navigate to that path
	currentPath = pathParam;
	loadDirectory(pathParam);
} else {
	// Load initial directory
	loadDirectory(currentPath);
}

// Keep track of back/forward options by the user too
window.addEventListener('popstate', e => {
	const urlParams = new URLSearchParams(window.location.search),
		pathParam = urlParams.get('path');

	if (pathParam) {
		currentPath = pathParam;
		loadDirectory(pathParam);
	}
});


// Load application paths
loadApplicationPaths();