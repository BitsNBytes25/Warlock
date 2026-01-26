const fileList = document.getElementById('fileList');
const currentPathEl = document.getElementById('currentPath');
const refreshBtn = document.getElementById('refreshBtn');
const upBtn = document.getElementById('upBtn');
const contextMenu = document.getElementById('contextMenu');
let contextMenuTarget = null;

// Search functionality (optional - only if search element exists)
const fileSearch = document.getElementById('fileSearch');
const searchClear = document.getElementById('searchClear');

let searchTimeout = null;
let isSearching = false;
let searchResults = null;

// Buttons used throughout this interface, they usually open a Modal.
const createFolderBtn = document.getElementById('createFolderBtn'),
	createFileBtn = document.getElementById('createFileBtn'),
	uploadBtn = document.getElementById('uploadBtn'),
	fileInput = document.getElementById('fileInput'),
	fileEditorSaveBtn = document.getElementById('fileEditorSaveBtn'),
	fileEditorDownloadBtn = document.getElementById('fileEditorDownloadBtn'),
	confirmCompressFolder = document.getElementById('confirmCompressFolder'),
	viewerSearchPrev = document.getElementById('viewerSearchPrev'),
	viewerSearchNext = document.getElementById('viewerSearchNext');

// Confirmation buttons within modals
const confirmCreateFolder = document.getElementById('confirmCreateFolder'),
	confirmCreateFile = document.getElementById('confirmCreateFile'),
	confirmUpload = document.getElementById('confirmUpload'),
	confirmDeleteBtn = document.getElementById('confirmDelete'),
	confirmRenameBtn = document.getElementById('confirmRename');


// Modal interfaces used throughout this interface.
const createFolderModal = document.getElementById('createFolderModal'),
	createFileModal = document.getElementById('createFileModal'),
	uploadModal = document.getElementById('uploadModal'),
	renameModal = document.getElementById('renameModal'),
	deleteModal = document.getElementById('deleteConfirmModal'),
	fileEditorModal = document.getElementById('fileEditorModal');


const fileEditorTextarea = document.getElementById('fileEditorTextarea'),
	fileEditorContainer = document.getElementById('fileEditorContainer');

const fileEditorStatus = document.getElementById('fileEditorStatus');
const renameNewName = document.getElementById('renameNewName');
const compressFolderModal = document.getElementById('compressFolderModal');

// CodeMirror instance
let codeMirrorEditor = null;

/**
 * Detect file syntax mode based on file mimetype and ensure the proper mode is loaded
 *
 * @param {string} mimetype - The mimetype of the file
 * @returns {string|null} - CodeMirror mode string
 */
async function detectSyntaxMode(mimetype) {
	return new Promise((resolve, reject) => {
		const modeMap = {
			'text/x-script.python': 'python',
			'application/json': 'json',
			'application/yaml': 'yaml',
			'text/x-shellscript': 'shell',
		};

		let mode = modeMap[mimetype] || null,
			modeSource = mode;

		if (mode) {
			if (mode === 'json') {
				modeSource = 'javascript';
				mode = 'application/json';
			}

			// Ensure the mode is loaded
			if (!document.head.querySelector('script[data-codemirror-mode="' + modeSource + '"]')) {
				const modeScript = document.createElement('script');
				modeScript.src = `/assets/codemirror/mode/${modeSource}/${modeSource}.js`;
				modeScript.dataset.codemirrorMode = modeSource;
				modeScript.onload = () => {
					resolve(mode);
				}
				document.head.appendChild(modeScript);
			}
			else {
				resolve(mode);
			}
		}
		else {
			resolve(mode);
		}
	});
}

/**
 * Initialize CodeMirror editor
 */
function initializeCodeMirror() {
	if (!fileEditorTextarea) return;
	
	codeMirrorEditor = CodeMirror.fromTextArea(fileEditorTextarea, {
		lineNumbers: true,
		mode: 'null',
		theme: 'material-darker',
		indentUnit: 4,
		tabSize: 4,
		indentWithTabs: false,
		lineWrapping: true,
		styleActiveLine: true,
		matchBrackets: true,
		autoCloseBrackets: true,
		showCursorWhenSelecting: true,
		viewportMargin: 10,
		extraKeys: {
			'Ctrl-S': function() {
				saveFile();
			},
			'Cmd-S': function() {
				saveFile();
			}
		}
	});
	
	// Update stats when editor content changes
	codeMirrorEditor.on('change', updateEditorStats);
}

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



async function performRecursiveSearch(query) {
	if (!query || query.length < 2) {
		// If search is cleared or too short, show current directory files
		if (searchResults) {
			loadDirectory();
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
                    <div>Searching in ${currentPathEl.textContent} and subdirectories...</div>
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
		'application/gzip': 'fas fa-file-archive',
		'application/x-gzip': 'fas fa-file-archive',
		'application/x-tar': 'fas fa-file-archive',
		'application/yaml': 'fas fa-file-lines',
		'text/x-script.python': 'fas fa-file-code',
		'text/x-shellscript': 'fas fa-file-code',
		'application/json': 'fas fa-file-lines',
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

	// Clear search when changing directories (if search exists)
	if (window.fileSearch) {
		fileSearch.value = '';
		searchResults = null;
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
			<div class="file-item" data-mimetype="${file.mimetype}" data-name="${file.name}" data-path="${file.path}">
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
				openFile(item);
			}
		});

		// Add right-click context menu
		el.addEventListener('contextmenu', showContextMenu);
	});
}

/**
 * Open a file for viewing or editing
 *
 * @param {HTMLDivElement} fileItem
 * @returns {Promise<void>}
 */
async function openFile(fileItem) {
	let filePath = fileItem.dataset.path;

	openModal(fileEditorModal);
	fileEditorContainer.innerHTML = '<div class="loading-spinner"></div> Loading file...';
	fileEditorModal.querySelector('h3').innerHTML = '<i class="fas fa-edit"></i> Edit File';
	fileEditorTextarea.value = '';
	if (codeMirrorEditor) {
		codeMirrorEditor.setValue('');
	}
	fileEditorSaveBtn.dataset.path = '';
	fileEditorSaveBtn.style.display = 'none';
	fileEditorDownloadBtn.dataset.path = '';
	fileEditorDownloadBtn.style.display = 'none';
	fileEditorStatus.style.display = 'none';

	fetch(`/api/file/${loadedHost}?path=${filePath}`, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
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
	// Clear previous content
	fileEditorContainer.innerText = '';
	// Populate editor
	fileEditorTextarea.value = '';
	fileEditorModal.querySelector('h3').innerHTML = '<i class="fas fa-eye"></i> Viewing ' + fileData.name;

	fileEditorDownloadBtn.dataset.path = fileData.path;
	fileEditorDownloadBtn.style.display = 'inline-flex';

	let cm = fileEditorModal.querySelector('.CodeMirror');
	if (cm) {
		cm.style.display = 'none';
	}

	let html = '';

	if (fileData.encoding === 'base64' && fileData.mimetype.startsWith('image/')) {
		const imgSrc = `data:${fileData.mimetype};base64,${fileData.content}`;
		html = `<div class="file-content"><img src="${imgSrc}" alt="${fileData.name}"/></div>`;
	}
	else if (fileData.encoding === 'base64' && fileData.mimetype.startsWith('video/')) {
		const videoSrc = `data:${fileData.mimetype};base64,${fileData.content}`;
		html = `<div class="file-content"><video controls><source src="${videoSrc}" type="${fileData.mimetype}"></video></div>`;
	}
	else {
		html = `<div class="file-content">${getFileIcon(fileData.mimetype)}</div>`;
	}

	// All files will have some basic information displayed.
	html += `<div class="file-info"><ul>
	<li>File name: ${fileData.name}</li>
	<li>File size: ${formatFileSize(fileData.size)}</li>
	<li>Mimetype: ${fileData.mimetype}</li>
</ul></div>`;

	fileEditorContainer.innerHTML = html;
}

/**
 * Open a file for editing
 *
 * @param {FileData} fileData
 */
function editFile(fileData) {
	detectSyntaxMode(fileData.mimetype).then(syntaxMode => {
		// Clear previous content
		fileEditorContainer.innerText = '';
		// Populate editor
		fileEditorTextarea.value = fileData.content;
		fileEditorModal.querySelector('h3').innerHTML = '<i class="fas fa-edit"></i> Editing ' + fileData.name;
		fileEditorSaveBtn.dataset.path = fileData.path;
		fileEditorSaveBtn.style.display = 'inline-flex';
		fileEditorStatus.style.display = 'block';

		let cm = fileEditorModal.querySelector('.CodeMirror');
		if (cm) {
			cm.style.display = 'block';
		}

		// Initialize CodeMirror if not already initialized
		if (!codeMirrorEditor) {
			initializeCodeMirror();
		}

		// Detect and set syntax mode based on file extension
		codeMirrorEditor.setOption('mode', syntaxMode);
		codeMirrorEditor.setValue(fileData.content);
		codeMirrorEditor.clearHistory();
	});
}

function updateEditorStats() {

	let content, lines, chars, words;
	
	// Use CodeMirror if available, otherwise fall back to textarea
	if (codeMirrorEditor) {
		content = codeMirrorEditor.getValue();
		lines = codeMirrorEditor.lineCount();
	} else {
		content = fileEditorTextarea.value;
		lines = content.split('\n').length;
	}
	
	chars = content.length;
	words = content.trim() ? content.trim().split(/\s+/).length : 0;

	fileEditorStatus.textContent = `${lines} lines, ${words} words, ${chars} characters`;
}

async function saveFile() {
	fileEditorSaveBtn.disabled = true;
	fileEditorSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

	// Get content from CodeMirror if available, otherwise from textarea
	let content;
	if (codeMirrorEditor) {
		content = codeMirrorEditor.getValue();
	} else {
		content = fileEditorTextarea.value;
	}

	fetch(`/api/file/${loadedHost}?path=${fileEditorSaveBtn.dataset.path}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'text/plain',
		},
		body: content
	})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				showToast('success', 'File saved successfully!');
				loadDirectory();
			}
			else {
				showToast('error', `Save failed: ${result.error}`);
			}
		})
		.catch(error => {
			showToast('error', `Save failed: ${error}`);
		})
		.finally(() => {
			fileEditorSaveBtn.disabled = false;
			fileEditorSaveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
		});
}

// New functionality functions
async function createFolder() {
	const folderName = document.getElementById('folderName').value.trim();
	if (!folderName) {
		alert('Please enter a folder name');
		return;
	}

	fetch(`/api/file/${loadedHost}?path=${currentPathEl.textContent}&name=${folderName}&isdir=1`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	}).then(response => response.json())
		.then(result => {
			if (result.success) {
				createFolderModal.style.display = 'none';
				loadDirectory(); // Refresh current directory
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

	fetch(`/api/file/${loadedHost}?path=${currentPathEl.textContent}&name=${fileName}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content: fileContent })
	})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				createFileModal.style.display = 'none';
				loadDirectory(); // Refresh current directory
			}
			else {
				alert(`Error creating file: ${result.error}`);
			}
		})
		.catch(error => {
			alert(`Network error: ${error.message}`);
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

function showRenameModal() {
	renameNewName.value = contextMenuTarget.dataset.name;
	renameNewName.dataset.path = contextMenuTarget.dataset.path;
	renameNewName.dataset.name = contextMenuTarget.dataset.name;
	openModal(renameModal);

	hideContextMenu();

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
	else if(e.target.closest('[data-path]')) {
		filePath = e.target.closest('[data-path]').dataset.path;
	}
	else if (contextMenuTarget) {
		filePath = contextMenuTarget.dataset.path;
	}
	else {
		return;
	}

	hideContextMenu();
	window.open(`/api/file/${loadedHost}?path=${filePath}&download=1`, '_blank');
}

async function performRename() {
	const newName = renameNewName.value.trim();

	if (!newName) {
		alert('Please enter a new name');
		return;
	}

	if (newName === renameNewName.dataset.name) {
		closeModal(renameModal);
		return;
	}

	const oldPath = renameNewName.dataset.path;
	const pathParts = oldPath.split('/');
	pathParts[pathParts.length - 1] = newName;
	const newPath = pathParts.join('/');

	fetch(`/api/file/${loadedHost}`, {
		method: 'MOVE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			oldPath: oldPath,
			newPath: newPath
		})
	})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				showToast('success', 'Item renamed successfully');
				closeModal(renameModal);
				loadDirectory(); // Refresh current directory
			} else {
				showToast('error', `Error renaming item: ${result.error}`);
			}
		}).catch(error => {
			showToast('error', `Network error: ${error.message}`);
		});
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
	uploadModal.classList.add('show');
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
			const response = await fetch(`/api/file/${loadedHost}?path=${currentPathEl.textContent}/${file.name}`, {
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
		uploadModal.classList.remove('show');
		loadDirectory(); // Refresh directory
		fileInput.value = ''; // Reset file input
	}, 1500);
}

function showDeleteModal() {
	deleteModal.querySelector('.filename').innerHTML = contextMenuTarget.dataset.path;
	deleteModal.dataset.path = contextMenuTarget.dataset.path;
	hideContextMenu();
	openModal(deleteModal);
}

async function performExtract() {
	let path = contextMenuTarget.dataset.path;

	showToast('info', `Extracting ${path}, please wait a moment.`);
	hideContextMenu();

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

async function performDelete() {
	closeModal(deleteModal);

	fetch(`/api/file/${loadedHost}?path=${deleteModal.dataset.path}`, {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(result => {
			if (result.success) {
				showToast('success', 'Item deleted successfully');
				loadDirectory(); // Refresh current directory
			}
			else {
				showToast('error', `Error deleting item: ${result.error}`);
			}
		});
}

function showCompressModal() {
	compressFolderModal.dataset.path = contextMenuTarget.dataset.path;
	hideContextMenu();
	openModal(compressFolderModal);
}

async function performCompress() {
	const path = compressFolderModal.dataset.path;
	const format = document.getElementById('folderCompressionType').value;

	showToast('info', `Compressing ${path}, this may take a few minutes depending on its size.`);
	closeModal(compressFolderModal);

	fetch(`/api/file/compress/${loadedHost}?path=${path}&format=${format}`, {
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
				showToast('error', `Error compressing archive: ${result.error}`);
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

// Save file being edited
fileEditorSaveBtn.addEventListener('click', saveFile);

// Download from within the editor/viewer
fileEditorDownloadBtn.addEventListener('click', performDownload);

// Editor textarea event listener for stats
document.getElementById('fileContent').addEventListener('input', updateEditorStats);


// Create folder
createFolderBtn.addEventListener('click', () => {
	document.getElementById('folderName').value = '';
	createFolderModal.classList.add('show');
	document.getElementById('folderName').focus();
});
confirmCreateFolder.addEventListener('click', createFolder);

// Create file
createFileBtn.addEventListener('click', () => {
	document.getElementById('fileName').value = '';
	document.getElementById('fileContent').value = '';
	createFileModal.classList.add('show');
	document.getElementById('fileName').focus();
});
confirmCreateFile.addEventListener('click', createFile);

// Upload file(s)
uploadBtn.addEventListener('click', () => {
	fileInput.click();
});
fileInput.addEventListener('change', (e) => {
	if (e.target.files.length > 0) {
		showUploadModal(e.target.files);
	}
});
confirmUpload.addEventListener('click', startUpload);

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
		openFile(contextMenuTarget);
	}
	else if (action === 'extract') {
		performExtract();
	}
	else if (action === 'download') {
		performDownload(e);
	}
	else if (action === 'rename') {
		showRenameModal();
	}
	else if (action === 'delete') {
		showDeleteModal();
	}
	else if (action === 'compress') {
		showCompressModal();
	}

	hideContextMenu();
});
// Rename file
confirmRenameBtn.addEventListener('click', performRename);

// Delete file
confirmDeleteBtn.addEventListener('click', performDelete);

// Hide context menu on click outside
document.addEventListener('click', (e) => {
	if (!e.target.closest('#contextMenu') && !e.target.closest('.three-dot-btn')) {
		hideContextMenu();
	}
});

renameNewName.addEventListener('keypress', e => {
	if (e.key === 'Enter') {
		performRename();
	}
});

confirmCompressFolder.addEventListener('click', performCompress);

// Confirm handlers


// Search functionality for unified viewer
let viewerMatches = [];
let viewerCurrentMatch = -1;

function performViewerSearchEvent(e) {
	const searchTerm = e.target.value,
		previewContent = document.getElementById('previewContent'),
		filePreviewContent = document.getElementById('filePreviewContent'),
		fileEditorContent = document.getElementById('fileEditorContent'),
		// Determine if we're searching in preview or editor
		isPreviewMode = filePreviewContent.style.display !== 'none',
		fileSearchNext = document.getElementById('viewerSearchNext'),
		fileSearchPrev = document.getElementById('viewerSearchPrev'),
		content = isPreviewMode ? previewContent : fileEditorTextarea;

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
		// Search in editor
		let textContent;
		if (codeMirrorEditor) {
			textContent = codeMirrorEditor.getValue();
		} else {
			textContent = fileEditorTextarea.value;
		}
		
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
		// Highlight in editor
		const searchInput = document.getElementById('viewerSearch');
		const searchTerm = searchInput.value;
		const matchIndex = viewerMatches[viewerCurrentMatch];

		if (codeMirrorEditor) {
			// Use CodeMirror's index-to-position helper for accurate selection
			const from = codeMirrorEditor.posFromIndex(matchIndex),
			      to = codeMirrorEditor.posFromIndex(matchIndex + searchTerm.length);
			
			codeMirrorEditor.focus();
			codeMirrorEditor.setSelection(from, to);
			
			// Scroll to selection
			codeMirrorEditor.scrollIntoView(from);
		} else {
			// Fallback to textarea
			fileEditorTextarea.focus();
			fileEditorTextarea.setSelectionRange(matchIndex, matchIndex + searchTerm.length);

			// Scroll to selection
			const lineHeight = parseFloat(getComputedStyle(fileEditorTextarea).lineHeight);
			const lines = fileEditorTextarea.value.substr(0, matchIndex).split('\n').length;
			fileEditorTextarea.scrollTop = (lines - 1) * lineHeight - fileEditorTextarea.clientHeight / 2;
		}
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
