/**
 * Represents the details of an application.
 *
 * @typedef {Object} AppData
 * @property {string} title Name of the application.
 * @property {string} guid Globally unique identifier of the application.
 * @property {string} icon Icon URL of the application.
 * @property {string} repo Repository URL fragment of the application.
 * @property {string} branch Branch name of the application repository, or RELEASE for latest tag released.
 * @property {string} installer Installer URL fragment of the application.
 * @property {string} source Source handler for the application installer.
 * @property {string} thumbnail Thumbnail URL of the application.
 * @property {string} image Full size image URL of the application.
 * @property {string} header Header image URL of the application.
 */

/**
 * Represents the details of a host specifically regarding an installed application.
 *
 * @typedef {Object} HostAppData
 * @property {string} host Hostname or IP of host.
 * @property {string} path Path where the application is installed on the host.
 *
 */

/**
 * Represents the details of a start/pre-start execution result from systemd
 *
 * @typedef {Object} ServiceExecResult
 * @property {string} arguments Raw arguments passed to the service handler
 * @property {string,null} code Exit code/message of the execution
 * @property {string} path Working path of the application when executed
 * @property {string} pid Process ID of the execution
 * @property {number} runtime Time taken for the execution in seconds, or NULL if still running
 * @property {number,null} start_time Timestamp of when the execution started
 * @property {number} status Numeric status code of the execution result, 0 means success
 * @property {number,null} stop_time Timestamp of when the execution stopped, or NULL if still running
 */

/**
 * Represents the details of a service.
 *
 * @typedef {Object} ServiceData
 * @property {string} name Name of the service, usually operator set for the instance/map name.
 * @property {string} service Service identifier registered in systemd.
 * @property {string} status Current status of the service, one of [running, stopped, starting, stopping].
 * @property {string} cpu_usage Current CPU usage of the service as a percentage or 'N/A'.
 * @property {string} memory_usage Current memory usage of the service in MB/GB or 'N/A'.
 * @property {number} game_pid Process ID of the game server process, or 0 if not running.
 * @property {number} service_pid Process ID of the service manager process, or 0 if not running.
 * @property {string} ip IP address the service is bound to.
 * @property {number} port Port number the service is using.
 * @property {number} player_count Current number of players connected to the service.
 * @property {number} max_players Maximum number of players allowed on the service.
 * @property {ServiceExecResult,null} pre_exec Details of the last start execution attempt.
 * @property {ServiceExecResult,null} start_exec Details of the last stop execution attempt.
 */

/**
 * Represents a configuration option for a given service or app
 *
 * @typedef {Object} AppConfigOption
 * @property {string} option Name of the configuration option.
 * @property {string|number|bool} value Current value of the configuration option.
 * @property {string|number|bool} default Default value of the configuration option.
 * @property {string} type Data type of the configuration option (str, int, bool, float, text).
 * @property {string} help Help text or description for the configuration option.
 */

/**
 * Representation of a file on the filesystem
 *
 * @typedef {Object} FileData
 * @property {string} name Basename of the file (without path)
 * @property {string} path Full path name of the file, (with symlinks resolving to the full destination)
 * @property {number} size Size of the file in bytes
 * @property {string} mimetype MIME type of the file, eg "text/plain" or "application/octet-stream"
 * @property {string} encoding Encoding to use for content parsing, or null if binary
 * @property {string} content Content of the file as a string, or null if binary
 */

/**
 * Representation of a server host
 *
 * @typedef {Object} HostData
 * @property {string} hostname Resolved system hostname of the host.
 * @property {boolean} connected Whether the host is currently connected.
 * @property {{name:string, title:string, version:string}} os Operating system information of the host.
 * @property {[{filesystem:string, fstype:string, used:int, avail:int, mountpoint:str}]} disks List of disk partitions on the host.
 */

/**
 * Cache of application data received from the backend.
 * @type {Object<string, AppData>}
 */
let applicationData = null;

/**
 * Cache of host data received from the backend.
 * @type {Object<string, HostData>}
 */
let hostData = null;

/**
 * Application GUID of the currently loaded application.
 *
 * @type {string|null}
 */
let loadedApplication = null;

/**
 * Host identifier of the currently loaded host.
 *
 * @type {string|null}
 */
let loadedHost = null;

/**
 * Fetches the list of services from the backend API.
 *
 * @returns {Promise<[{app: AppData, host: HostAppData, service: ServiceData}]>} A promise that resolves to an array of AppDetails objects.
 */
async function fetchServices() {
	return new Promise((resolve, reject) => {
		fetch('/api/services', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		})
			.then(response => response.json())
			.then(response => {
				if (response.success) {
					return resolve(response.services);
				}
			});
	});
}

/**
 * Fetches the list of services from the backend API.
 *
 * @returns {Promise<ServiceData>} A promise that resolves to an array of AppDetails objects.
 */
async function fetchService(app_guid, host, service) {
	return new Promise((resolve, reject) => {
		fetch(`/api/service/${app_guid}/${host}/${service}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		})
			.then(response => response.json())
			.then(response => {
				if (response.success) {
					return resolve(response.service);
				}
			});
	});
}

/**
 * Fetches the list of applications from the backend API or localStorage.
 *
 * @returns {Promise<Object.<string, AppData>>} A promise that resolves to an object mapping GUIDs to AppData objects.
 */
async function fetchApplications() {
	// Try to use localStorage for faster results, defaulting back to the manual fetch
	return new Promise((resolve, reject) => {
		if (applicationData) {
			return resolve(applicationData);
		}

		fetch('/api/applications', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		})
			.then(response => {
				return response.json()
			})
			.then(result => {
				if (result.success && result.applications) {
					applicationData = result.applications;
					resolve(result.applications);
				} else {
					reject(result.error);
				}
			})
			.catch(error => {
				console.error('Error fetching applications:', error);
				reject(error);
			});
	});
}

async function fetchHosts() {
	return new Promise((resolve, reject) => {
		fetch('/api/hosts', {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		})
			.then(response => response.json())
			.then(response => {
				if (response.success) {
					hostData = response.hosts;
					return resolve(response.hosts);
				}
				else {
					reject(response.error);
				}
			})
			.catch(error => {
				console.error('Error fetching hosts:', error);
				reject(error);
			});
	});
}

/**
 * Get the base repository URL for an application.
 *
 * @param {string} guid
 * @returns {string|null}
 */
function getRepoURL(guid) {
	let appData = applicationData && applicationData[guid] || null;

	if (!appData) {
		return null;
	}

	// Probably hosted from the original repo, so prepend that data.
	if (appData.source === 'github') {
		// We don't have the time to determine the latest release tag, so just use main
		// This is not suitable for the application files which should be the exact release,
		// but will be fine for static assets.
		let branch = 'main';
		if (appData.branch) {
			if (appData.branch !== 'RELEASE') {
				// Developer specifically set a branch
				branch = appData.branch;
			}
		}
		return `https://raw.githubusercontent.com/${appData.repo}/${branch}`;
	}
	else {
		// Unsupported source
		return null;
	}
}

/**
 * Get the rendered HTML for an application icon.
 *
 * @param {string} guid
 * @returns {string}
 */
function renderAppIcon(guid) {
	let appData = applicationData && applicationData[guid] || null,
		url;

	if (appData && appData.icon) {
		url = appData.icon;
		if (!url.includes('://')) {
			// Probably hosted from the original repo, so prepend that data.
			url = getRepoURL(guid);
			if (url) {
				url += '/' + appData.icon;
			}
		}
	}

	if (url) {
		return `<img src="${url}" alt="${appData.title} Icon" title="${appData.title} Icon">`;
	}
	else {
		return '<i class="fas fa-cube" style="font-size: 1.5rem; color: white;"></i>';
	}
}

/**
 * Get the URL source for an application thumbnail.
 *
 * @param {string} guid
 * @returns {string|null}
 */
function getAppThumbnail(guid) {
	let appData = applicationData && applicationData[guid] || null,
		url;

	if (appData && appData.thumbnail) {
		url = appData.thumbnail;
		if (!url.includes('://')) {
			// Probably hosted from the original repo, so prepend that data.
			url = getRepoURL(guid);
			if (url) {
				return `${url}/${appData.thumbnail}`;
			}
		}
		else {
			return url;
		}
	}
	else {
		return null;
	}
}

/**
 * Get the URL source for an application full-size image.
 *
 * @param {string} guid
 * @returns {string|null}
 */
function getAppImage(guid) {
	let appData = applicationData && applicationData[guid] || null,
		url;

	if (appData && appData.image) {
		url = appData.image;
		if (!url.includes('://')) {
			// Probably hosted from the original repo, so prepend that data.
			url = getRepoURL(guid);
			if (url) {
				return `${url}/${appData.image}`;
			}
		}
		else {
			return url;
		}
	}
	else {
		return null;
	}
}

/**
 * Get the rendered hostname for a given host identifier.
 *
 * @param {string} host
 * @returns {string}
 */
function renderHostName(host) {
	let hostInfo = hostData && hostData[host] || null;

	if (hostInfo && hostInfo.hostname) {
		return '<span title="' + host + '">' + hostInfo.hostname + '</span>';
	}
	else {
		return host;
	}
}

/**
 * Get the rendered HTMLImageElement for a host OS thumbnail.
 *
 * @param {string} host Host name or IP address
 * @returns {HTMLImageElement}
 */
function renderHostOSThumbnail(host) {
	let hostInfo = hostData && hostData[host] || null;

	const thumbnail = document.createElement('img');
	thumbnail.className = 'os-thumbnail';
	if (hostInfo.os.name && hostInfo.os.version) {
		thumbnail.src = `/assets/media/wallpapers/servers/${hostInfo.os.name.toLowerCase()}_${hostInfo.os.version.toLowerCase()}.webp`;
		thumbnail.dataset.fallback = '/assets/media/wallpapers/servers/generic.webp';
		thumbnail.alt = hostInfo.os.name;
		thumbnail.onerror = "this.onerror=null;this.src=this.dataset.fallback;";
	}
	else {
		thumbnail.src = '/assets/media/wallpapers/servers/generic.webp';
	}

	return thumbnail;
}

/**
 * Get the rendered HTML for a host connection icon.
 *
 * @param {host} host
 * @returns {string}
 */
function renderHostIcon(host) {
	let hostInfo = hostData && hostData[host] || null;

	if (hostInfo && hostInfo.connected && hostInfo.os.name) {
		return '<img src="/assets/media/logos/servers/' + hostInfo.os.name.toLowerCase() + '.svg" alt="' + hostInfo.os.title + ' Icon" title="' + hostInfo.os.title + '">';
	}
	else {
		return '<i class="fas fa-desktop" title="Disconnected"></i>';
	}
}

/**
 * Format bytes as human-readable text.
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function serviceAction(guid, host, service, action) {
	return new Promise((resolve, reject) => {
		fetch(`/api/service/control/${guid}/${host}/${service}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				action: action
			})
		})
			.then(response => response.json())
			.then(response => {
				resolve(response);
			})
			.catch(error => {
				reject(error);
			});
	});
}

/**
 * Replace all placeholders in the document with application-specific data.
 *
 * @param {AppData} app
 */
function replaceAppPlaceholders(app) {
	// Automatic replacements of the content
	document.querySelectorAll('.app-name-placeholder').forEach(el => {
		el.innerHTML = app.title;
	});

	if (document.body.dataset.useAppBackground && app.image) {
		let url = getAppImage(app.guid);
		if (url) {
			document.body.style.backgroundImage = `url(${url})`;
		}
	}

	if (
		document.querySelector('.content-header') &&
		document.querySelector('.content-header').dataset.useAppHeader &&
		app.header
	) {
		document.querySelector('.content-header').style.backgroundImage = `url(${app.header})`;
	}
}

/**
 * Replace all placeholders in the document with application-specific data.
 *
 * @param {HostData} host
 */
function replaceHostPlaceholders(host) {
	// Automatic replacements of the content
	document.querySelectorAll('.host-name-placeholder').forEach(el => {
		el.innerHTML = host.hostname;
	});
}

/**
 * Load application data for the given GUID.
 *
 * @param {string} guid
 * @returns {Promise<void>}
 */
async function loadApplication(guid) {
	return new Promise((resolve, reject) => {
		fetchApplications()
			.then(applications => {
				const app = applications[guid] || null;

				if (!app) {
					return reject('Application not found.');
				}

				loadedApplication = guid;

				// Replace content from application
				replaceAppPlaceholders(app);
				resolve(app);
			})
			.catch(error => {
				reject(error);
			});
	});
}

/**
 * Load host data for the given host identifier.
 *
 * @param {string} host
 * @returns {Promise<unknown>}
 */
async function loadHost(host) {
	return new Promise((resolve, reject) => {
		fetchHosts()
			.then(hosts => {
				const hostInfo = hosts[host] || null;

				if (!hostInfo) {
					return reject('Host not found.');
				}

				loadedHost = host;

				// Replace content from application
				replaceHostPlaceholders(hostInfo);
				resolve(hostInfo);
			})
			.catch(error => {
				reject(error);
			});
	});
}

/**
 * Stream an HTTP request and parse SSE-like events from the response.
 *
 * @param {string} url URL to send the request to
 * @param {string} method HTTP method to use (default: 'POST')
 * @param {Object} headers HTTP headers to include in the request
 * @param {*} body Request body to send (default: null)
 * @param {function} messageHandler Callback function to handle parsed events (event, data)
 * @returns {Promise<void>}
 */
async function stream(
	url,
	method = 'POST',
	headers = {},
	body = null,
	messageHandler = null
) {
	return new Promise(async (resolve, reject) => {
		let controller = null;
		let reader = null;

		controller = new AbortController();
		const signal = controller.signal;

		const parseSSEBlock = (block) => {
			// Parse SSE-style block (lines like "data: ..." and optionally "event: ...")
			const lines = block.split(/\r?\n/);
			let event = 'message';
			const dataLines = [];
			for (const line of lines) {
				if (line.startsWith('event:')) {
					event = line.slice(6).trim();
				} else if (line.startsWith('data:')) {
					dataLines.push(line.slice(5).trim());
				} else if (line.startsWith('stdout:')) {
					event = 'stdout';
					dataLines.push(line.slice(7).trim());
				} else if (line.startsWith('stderr:')) {
					event = 'stderr';
					dataLines.push(line.slice(7).trim());
				}
			}
			const data = dataLines.join('\n');

			if (event === 'error') {
				throw new Error(data);
			}

			if (messageHandler) {
				messageHandler(event, data);
			}
		}

		try {
			const res = await fetch(url, {
				method: method,
				headers: headers,
				body: body,
				signal
			});

			if (!res.ok) {
				const text = await res.text();
				return reject(`[HTTP ${res.status}] ${text}`);
			}

			// Stream the response body and parse SSE-like chunks
			const decoder = new TextDecoder();
			reader = res.body.getReader();
			let buffer = '';

			while (true) {
				if (reader === null) {
					// Stream completed.
					break;
				}
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });

				// Process complete blocks separated by blank line(s)
				let sepIndex;
				while ((sepIndex = buffer.indexOf('\n\n')) !== -1 || (sepIndex = buffer.indexOf('\r\n\r\n')) !== -1) {
					// prefer \r\n\r\n detect above, index found already
					const block = buffer.slice(0, sepIndex);
					buffer = buffer.slice(sepIndex + (buffer[sepIndex] === '\r' ? 4 : 2)); // remove separator
					if (block.trim()) parseSSEBlock(block);
				}
			}

			// handle any trailing buffer
			if (buffer.trim()) parseSSEBlock(buffer);
		} catch (err) {
			if (err.name === 'AbortError') {
				return reject(`[stream aborted]`);
			} else {
				return reject(`${err.message}`);
			}
		} finally {
			if (reader) {
				try { reader.cancel(); } catch (e) {}
				reader = null;
			}
			if (controller) {
				try { controller.abort(); } catch (e) {}
				controller = null;
			}
		}

		return resolve();
	});
}


/**
 * Extract path parameters from a template string.
 * The behaviour of this is similar to Express.js route parameters.
 *
 * @param {string} urlTemplate
 */
function getPathParams(urlTemplate) {
	// urlTemplate will be in the format of /some/path/:param1/:param2
	// Where the return values will be { param1: value1, param2: value2 }
	const params = {};
	const templateParts = urlTemplate.split('/').filter(part => part);
	const currentPath = window.location.pathname.split('/').filter(part => part);

	if (templateParts.length !== currentPath.length) {
		return params; // Mismatched lengths, return empty
	}

	templateParts.forEach((part, index) => {
		if (part.startsWith(':')) {
			const paramName = part.slice(1);
			params[paramName] = decodeURIComponent(currentPath[index]);
		}
	});

	return params;
}

function parseTerminalCodes(data) {
	// Simple parsing of terminal escape codes for colors and styles
	const ESC = '\u001b[';
	const RESET = ESC + '0m';

	const styleMap = {
		'30': 'color: black;',
		'31': 'color: red;',
		'32': 'color: green;',
		'33': 'color: yellow;',
		'34': 'color: blue;',
		'35': 'color: magenta;',
		'36': 'color: cyan;',
		'37': 'color: white;',
		'40': 'background-color: black;',
		'41': 'background-color: red;',
		'42': 'background-color: green;',
		'43': 'background-color: yellow;',
		'44': 'background-color: blue;',
		'45': 'background-color: magenta;',
		'46': 'background-color: cyan;',
		'47': 'background-color: white;',
		'90': 'color: gray;',
		'91': 'color: lightred;',
		'92': 'color: lightgreen;',
		'93': 'color: lightyellow;',
		'94': 'color: lightblue;',
		'95': 'color: lightmagenta;',
		'96': 'color: lightcyan;',
		'97': 'color: lightwhite;',
		'100': 'background-color: gray;',
		'101': 'background-color: lightred;',
		'102': 'background-color: lightgreen;',
		'103': 'background-color: lightyellow;',
		'104': 'background-color: lightblue;',
		'105': 'background-color: lightmagenta;',
		'106': 'background-color: lightcyan;',
		'107': 'background-color: lightwhite;',
		'1': 'font-weight: bold;',
		'2': 'opacity: 0.8;',
		'3': 'font-style: italic;',
		'4': 'text-decoration: underline;',
	};

	let result = '';
	let parts = data.split(ESC);
	let depth = 0;

	result += parts[0]; // initial text before any escape codes

	for (let i = 1; i < parts.length; i++) {
		let part = parts[i];
		let codeEnd = part.indexOf('m');
		if (codeEnd !== -1) {
			let code = part.slice(0, codeEnd);
			let text = part.slice(codeEnd + 1);

			if (code === '0') {
				// Reset code
				result += '</span>' + text;
				depth = Math.max(0, depth - 1);
			} else if (styleMap[code]) {
				// Known style code
				result += `<span style="${styleMap[code]}">` + text;
				depth += 1;
			} else {
				// Unknown code
				console.debug(`Unknown terminal code: ${code}`);
				// Unknown code, just append as is
				result += text;
			}
		} else {
			// No 'm' found, just append as is
			result += ESC + part;
		}
	}

	// Close any unclosed spans
	for (let j = 0; j < depth; j++) {
		result += '</span>';
	}

	return result;
}

// UI Toast helper: creates bottom-center toasts, newest on top, auto-dismiss and click-to-dismiss
function showToast(type, message, duration = 4000) {
	try {
		const allowed = ['success', 'error', 'warning', 'info'];
		const t = allowed.includes(type) ? type : 'info';

		let container = document.getElementById('toast-container');
		if (!container) {
			container = document.createElement('div');
			container.id = 'toast-container';
			document.body.appendChild(container);
		}

		const toast = document.createElement('div');
		toast.className = 'toast toast--' + t;
		toast.setAttribute('role', 'status');
		toast.setAttribute('aria-live', 'polite');
		toast.textContent = message;

		// Prepend so newest appears on top
		if (container.firstChild) container.insertBefore(toast, container.firstChild);
		else container.appendChild(toast);

		// Trigger show transition
		requestAnimationFrame(() => {
			// small delay ensures initial styles applied
			toast.classList.add('show');
		});

		let removed = false;
		const cleanup = () => {
			if (toast.parentNode) toast.parentNode.removeChild(toast);
		};

		const removeToast = () => {
			if (removed) return;
			removed = true;
			toast.classList.remove('show');
			// wait for transition to complete before removing
			const onEnd = (ev) => {
				if (ev.propertyName === 'transform' || ev.propertyName === 'opacity') {
					toast.removeEventListener('transitionend', onEnd);
					cleanup();
				}
			};
			toast.addEventListener('transitionend', onEnd);
			// Fallback in case transitionend doesn't fire
			setTimeout(cleanup, 600);
		};

		const timer = setTimeout(removeToast, duration);

		// Click to dismiss immediately
		toast.addEventListener('click', () => {
			clearTimeout(timer);
			removeToast();
		});
	} catch (err) {
		// Fail silently; toasts are non-critical
		console.error('showToast error', err);
	}
}

/**
 * Output data (usually text) to a terminal-like container, parsing terminal codes.
 *
 * @param {*} terminalOutput
 * @param {string} event
 * @param {string} data
 */
function terminalOutputHelper(terminalOutput, event, data) {
	let scrolledToBottom = terminalOutput.scrollHeight - terminalOutput.clientHeight <= terminalOutput.scrollTop + 1;

	// Swap any < ... > to prevent HTML issues
	data = data.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	// Put pretty colors in place
	data = parseTerminalCodes(data);

	// Append output
	terminalOutput.innerHTML += `<div class="line-${event}">${data}</div>`;

	// Scroll to bottom
	if (scrolledToBottom) {
		terminalOutput.scrollTop = terminalOutput.scrollHeight;
	}
}

/**
 * Convert a GMT timestamp to a local date string
 *
 * @param {int} unixTime
 * @returns {string}
 */
function convertTimestampToDateTimeString(unixTime) {
	const date = new Date(unixTime * 1000);
	return date.toLocaleString();
}

async function loadCronJob(host, identifier, target) {
	return new Promise((resolve, reject) => {
		if (target && !target.dataset.autoEventsAdded) {
			// Add change event to schedule selector to show/hide relevant fields
			let schedule, time, day;
			schedule = target.querySelector('[name="schedule"]');
			time = target.querySelector('[name="time"]');
			day = target.querySelector('[name="weekly_day"]');
			target.dataset.autoEventsAdded = '1';

			schedule.addEventListener('change', () => {
				if (schedule.value === 'weekly') {
					time.closest('.form-group').style.display = 'flex';
					day.closest('.form-group').style.display = 'flex';
				}
				else if (schedule.value === 'daily') {
					time.closest('.form-group').style.display = 'flex';
					day.closest('.form-group').style.display = 'none';
				}
				else if (schedule.value === 'hourly') {
					time.closest('.form-group').style.display = 'none';
					day.closest('.form-group').style.display = 'none';
				}
				else {
					time.closest('.form-group').style.display = 'none';
					day.closest('.form-group').style.display = 'none';
				}
			});
		}

		fetch(`/api/cron/${host}`, { method: 'GET' })
			.then(r => r.json())
			.then(data => {
				if (!data.success) {
					return reject(data);
				}

				let schedule, time, day;
				if (target) {
					// Load the form elements for the target UI, (optionally)
					schedule = target.querySelector('[name="schedule"]');
					time = target.querySelector('[name="time"]');
					day = target.querySelector('[name="weekly_day"]');
				}

				const jobs = data.jobs || [];
				const job = jobs.find(j => j.identifier === identifier);
				if (!job) {
					if (schedule) {
						schedule.value = 'disabled';
						schedule.dispatchEvent(new CustomEvent('change'));
					}

					return resolve(null);
				}
				else {
					// parse schedule
					const parts = job.schedule.split(/\s+/);
					if (parts.length >= 5) {
						const minute = parts[0].padStart(2, '0');
						const hour = parts[1].padStart(2, '0');

						if (parts[1] === '*') {
							// 0 * * * *
							if (schedule) {
								schedule.value = 'hourly';
								schedule.dispatchEvent(new CustomEvent('change'));
							}
						}
						else if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
							// X X * * *
							if (time) {
								time.value = `${hour}:${minute}`;
							}
							if (schedule) {
								schedule.value = 'daily';
								schedule.dispatchEvent(new CustomEvent('change'));
							}
						}
						else if (parts[2] === '*' && parts[3] === '*') {
							// X X * * DOW
							if (time) {
								time.value = `${hour}:${minute}`;
							}
							if (day) {
								// map day number to option
								const dowNum = parts[4];
								const dowMap = {
									'0': 'sun',
									'1': 'mon',
									'2': 'tue',
									'3': 'wed',
									'4': 'thu',
									'5': 'fri',
									'6': 'sat',
									'7': 'sun'
								};
								day.value = dowMap[dowNum] || 'sun';
							}
							if (schedule) {
								schedule.value = 'weekly';
								schedule.dispatchEvent(new CustomEvent('change'));
							}
						}
					}

					return resolve(job);
				}
			})
			.catch(() => {
				// ignore fetch errors; show defaults
			});
	});
}

function parseCronSchedule(target) {
	const schedule = target.querySelector('[name="schedule"]'),
		time = target.querySelector('[name="time"]'),
		day = target.querySelector('[name="weekly_day"]');

	if (schedule.value === 'disabled') {
		return 'DISABLED';
	}
	else if (schedule.value === 'hourly') {
		return '0 * * * *';
	}
	else if (schedule.value === 'daily') {
		const [hour, minute] = time.value.split(':');
		return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
	}
	else if (schedule.value === 'weekly') {
		const [hour, minute] = time.value.split(':');
		const dow = day.value; // mon, tue...
		const dowMap = {'sun': '0', 'mon': '1', 'tue': '2', 'wed': '3', 'thu': '4', 'fri': '5', 'sat': '6'};
		return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * ${dowMap[dow]}`;
	}
	else {
		console.warn('Unknown schedule type selected:', schedule.value);
		return 'DISABLED';
	}
}


document.addEventListener('DOMContentLoaded', () => {
	// Add standard close events to Modals
	document.querySelectorAll('.modal-close').forEach(button => {
		button.addEventListener('click', (e) => {
			const modal = e.target.closest('.modal');
			if (modal) {
				modal.classList.remove('show');
			}
		});
	});

	// Clicking outside the modal content also closes the modal
	document.querySelectorAll('.modal-overlay').forEach(overlay => {
		overlay.addEventListener('click', e => {
			const modal = e.target.closest('.modal');
			if (modal) {
				modal.classList.remove('show');
			}
		});
	});

	// Pressing escape closes any open modals
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			document.querySelectorAll('.modal.show').forEach(modal => {
				modal.classList.remove('show');
			});
		}
	});
});

