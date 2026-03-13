/**
 * Represents the details of an application.
 *
 * @typedef {Object} AppData
 * @property {string} title Name of the application.
 * @property {string} guid Globally unique identifier of the application.
 * @property {string} icon Icon URL of the application.
 * @property {string} repo Repository URL fragment of the application.
 * @property {string} installer Installer URL fragment of the application.
 * @property {string} source Source handler for the application installer.
 * @property {string} thumbnail Thumbnail URL of the application.
 * @property {string} image Full size image URL of the application.
 * @property {string} header Header image URL of the application.
 * @property {string} author Author information of the app, usually contains name and email.
 * @property {string[]} supports List of OS support, usually "[Distro Name] [Version List]",...
 */

/**
 * Represents the details of a host specifically regarding an installed application.
 *
 * @typedef {Object} HostAppData
 * @property {string}   host    Hostname or IP of host.
 * @property {string}   path    Path where the application is installed on the host.
 * @property {[string]} options List of available options supported by the application installation on this host.
 * @property {number}   version Version of the API for the game manager
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
 * @property {string} name          Name of the service, usually operator set for the instance/map name.
 * @property {string} service       Service identifier registered in systemd.
 * @property {bool}   enabled       Whether the service is enabled to start on boot.
 * @property {string} ip            WAN IP address detected for the service
 * @property {number} port          Port number the service is using.
 * @property {string} app_dir       Full directory path this game files are installed into
 * @property {string} bak_dir       Full directory path that contains backup files
 * @property {boolean} multi_binary Set to true if each game instance uses a different binary
 * @property {string} cpu_usage     Current CPU usage of the service as a percentage or 'N/A'.
 * @property {number} max_players   Maximum number of players allowed on the service.
 * @property {string} memory_usage  Current memory usage of the service in MB/GB or 'N/A'.
 * @property {string} response_time Time in ms the service took to respond via the API
 */

/**
 * Represents the details of a service.
 *
 * @typedef {Object} FullServiceData
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
 * @property {string} group Optional group name for categorizing configuration options in the UI.
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
 * @type {AppData[]|null}
 */
let applicationData = null;

/**
 * Cache of host data received from the backend.
 * @type {HostData[]|null}
 */
let hostData = null;

/**
 * Cache of service data received from the backend.
 *
 * Each
 * @type {[{app:string, host:HostAppData, service:ServiceData}]}
 */
let serviceData = null;

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
 * Service identifier of the currently loaded service.
 *
 * @type {string|null}
 */
let loadedService = null;

/**
 * Loaded application data for the currently loaded application.
 *
 * @type {AppData|null}
 */
let loadedApplicationData = null;

/**
 * Loaded host data for the currently loaded host.
 *
 * @type {HostData|null}
 */
let loadedHostData = null;

/**
 * Loaded service data for the currently loaded service.
 *
 * @type {ServiceData|null}
 */
let loadedServiceData = null;

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
 * Fetches the list of applications from the backend API.
 *
 * @returns {Promise<AppData[]>}
 */
async function fetchApplications() {
	return fetch('/api/applications', {
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
				return result.applications;
			}
			else {
				throw new Error(result.error);
			}
		});
}

async function fetchHosts() {
	return fetch('/api/hosts', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	})
		.then(response => response.json())
		.then(response => {
			if (response.success) {
				hostData = response.hosts;
				return response.hosts;
			}
			else {
				throw new Error(response.error);
			}
		});
}

/**
 * Get the base repository URL for an application.
 *
 * @param {string} guid
 * @returns {string|null}
 */
function getRepoURL(guid) {
	let appData = getApplicationData(guid);

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
 * Get a list of branches and their last commit date for a given repo, if supported.
 *
 * @param {string} source Usually "github"
 * @param {string} repo Repository identifier, usually "author/name"
 * @returns {Promise<[{branch:string, date:string, default:bool}]>} Array of branch names and their last commit date.
 */
async function getRepoBranches(source, repo) {
	return new Promise((resolve, reject) => {
		if (source === 'github') {
			fetch(`https://api.github.com/repos/${repo}/branches`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			})
				.then(response => response.json())
				.then(response => {
					let branches = [],
						promises = [],
						urlToBranch = {},
						// Branches which should get set as default, IN ORDER of the preference.
						defaultBranches = ['stable', 'main', 'master'];
					response.forEach(branch => {
						if (typeof(urlToBranch[branch.commit.url]) !== 'undefined') {
							// Multiple branches point to the same commit, skip duplicate fetch
							if (defaultBranches.includes(branch.name)) {
								// Prefer the more stable name
								urlToBranch[branch.commit.url] = branch.name;
							}
						}
						else {
							urlToBranch[branch.commit.url] = branch.name;
							promises.push(fetch(branch.commit.url, {method: 'GET', headers: { 'Content-Type': 'application/json'} }).then(r => r.json()));
						}
					});

					Promise.allSettled(promises).then(results => {
						results.forEach(result => {
							if (result.status === 'fulfilled') {
								branches.push({
									branch: urlToBranch[result.value.url],
									date: result.value.commit.committer.date,
									default: false
								});
							}
						});

						// Sort branches by date descending
						branches.sort((a, b) => new Date(b.date) - new Date(a.date));

						// Mark default branch
						for (let defBranch of defaultBranches) {
							let found = branches.find(b => b.branch === defBranch);
							if (found) {
								found.default = true;
								break;
							}
						}

						resolve(branches);
					});
				})
				.catch(error => {
					reject(error);
				});
		}
	});
}

/**
 * Get the application data for a given GUID.
 *
 * Expects fetchApplications() to have been called beforehand!
 *
 * @param {string} guid
 * @returns {AppData|null}
 */
function getApplicationData(guid) {
	if (applicationData === null) {
		// Apps not loaded.
		return null;
	}

	return applicationData.find(app => app.guid === guid) || null;
}

/**
 * Get the host installation data for a given application
 *
 * @param {string} guid
 * @param {string} host
 * @returns {HostAppData|null}
 */
function getHostInstallData(guid, host) {
	const appData = getApplicationData(guid);
	if (!appData) {
		return null;
	}

	return appData.installs.find(h => h.host === host) || null;
}

/**
 * Get the rendered HTML for an application icon.
 *
 * @param {string} guid
 * @returns {string}
 */
function renderAppIcon(guid) {
	let appData = getApplicationData(guid),
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
		return `<img src="${url}" alt="${appData.title} Icon" title="${appData.title}">`;
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
	let appData = getApplicationData(guid),
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
	let appData = getApplicationData(guid),
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
 * Get the API version for a given application on the target host.
 *
 * @param {string} guid
 * @param {string} host
 */
function getAppAPIVersion(guid, host) {
	let appData = getApplicationData(guid),
		hostData;

	if (!appData) {
		// Applications not loaded or the requested app doesn't exist.
		return null;
	}

	hostData = appData.hosts.find(h => h.host === host) || null;
	if (!hostData) {
		// Host not found for this application.
		return null;
	}

	return hostData.version || 1;
}

/**
 * Get the rendered hostname for a given host identifier.
 *
 * @param {string} host
 * @param {boolean} asHTML Whether to return the hostname as HTML with a tooltip of the full host, or as plain text with the host in parentheses.
 * @returns {string}
 */
function renderHostName(host, asHTML = true) {
	let hostInfo = hostData && hostData[host] || null;

	if (hostInfo && hostInfo.hostname) {
		if (asHTML) {
			return '<span title="' + host + '">' + hostInfo.hostname + '</span>';
		}
		else {
			return hostInfo.hostname + ' (' + host + ')';
		}
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
	let hostInfo = hostData.find( h => h.host === host ) || null;

	const thumbnail = document.createElement('img');
	thumbnail.className = 'os-thumbnail';

	if (!hostInfo) {
		// Default for if the host information could not be loaded.
		thumbnail.src = '/assets/media/wallpapers/servers/generic.webp';
		return thumbnail;
	}

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
	let hostInfo = hostData.find( h => h.host === host ) || null;

	if (hostInfo && hostInfo.os.name) {
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

/**
 * Format bits per second as human-readable text.
 *
 * @param {number} bits
 * @returns {string}
 */
function formatBitSpeed(bits) {
	if (bits === 0) return '0 bps';
	const k = 1024;
	const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps'];
	const i = Math.floor(Math.log(bits) / Math.log(k));
	return parseFloat((bits / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Perform a service action (start, stop, restart, etc) via the backend API.
 *
 * @param guid
 * @param host
 * @param service
 * @param action
 * @returns {Promise<unknown>}
 */
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
 * Replace all placeholders in the document with service-specific data.
 *
 * @param service
 */
function replaceServicePlaceholders(service) {
	document.querySelectorAll('.service-service-placeholder').forEach(el => {
		el.innerHTML = service.service;
	});

	document.querySelectorAll('.service-name-placeholder').forEach(el => {
		el.innerHTML = service.name;
	});
}

/**
 * Load application data for the given GUID.
 *
 * @param {string} guid
 * @returns {Promise<AppData>}
 */
async function loadApplication(guid) {
	if (applicationData && applicationData.length > 0) {
		// Try to find the application that's in the cache.
		let cachedApp = applicationData.find(app => app.guid === guid) || null;
		if (cachedApp) {
			loadedApplication = guid;
			loadedApplicationData = cachedApp;

			// Replace content from application
			replaceAppPlaceholders(cachedApp);

			return loadedApplicationData;
		}
	}

	return fetchApplications()
		.then(applications => {
			const app = applications.find(app => app.guid === guid) || null;

			if (!app) {
				throw new Error(`Application '${guid}' not found.`);
			}

			loadedApplication = guid;
			loadedApplicationData = app;

			// Replace content from application
			replaceAppPlaceholders(app);

			return app;
		});
}

/**
 * Load host data for the given host identifier.
 *
 * @param {string} host
 * @returns {Promise<unknown>}
 */
async function loadHost(host) {
	if (hostData && hostData.length > 0) {
		// Try to find the application that's in the cache.
		let cachedHost = hostData.find(h => h.host === host) || null;
		if (cachedHost) {
			loadedHost = host;
			loadedHostData = cachedHost;

			// Replace content from application
			replaceHostPlaceholders(cachedHost);

			return cachedHost;
		}
	}

	return fetchHosts()
		.then(hosts => {
			const hostInfo = hosts.find(h => h.host === host) || null;

			if (!hostInfo) {
				throw new Error(`Host '${host}' not found.`);
			}

			loadedHost = host;
			loadedHostData = hostInfo;

			// Replace content from application
			replaceHostPlaceholders(hostInfo);

			return hostInfo;
		});
}

/**
 * Load service data for the given application GUID, host, and service identifier.
 *
 * @param app_guid
 * @param host
 * @param service
 * @returns {Promise<ServiceData>}
 */
async function loadService(app_guid, host, service) {
	return new Promise((resolve, reject) => {
		fetchService(app_guid, host, service)
			.then(serviceData => {
				// Set the new data, (this is done prior to dispatching events in case a caller expects the object to be ready)
				loadedService = serviceData.service;
				loadedServiceData = serviceData;

				// Dispatch event notifiers that things changed
				document.dispatchEvent(new CustomEvent('serviceChange', {detail: loadedServiceData}));

				// Replace content from service
				replaceServicePlaceholders(serviceData);

				resolve(serviceData);
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
 * @param {bool} reconnect Whether to attempt reconnection on disconnect (default: false)
 * @returns {Promise<void> & {controller:AbortController, cancel:function}} Promise that resolves when the stream completes. The returned promise is augmented with a `.controller` (AbortController) and `.cancel()` to allow external cancellation.
 */
function stream(
	url,
	method = 'POST',
	headers = {},
	body = null,
	messageHandler = null,
	reconnect = false
) {
	// We'll return a promise that resolves when the stream ends. Attach controller and cancel to the
	// returned promise so callers can cancel the stream (either via `.controller.abort()` or `.cancel()`).
	let controller = new AbortController();
	const signal = controller.signal;
	let reader = null;
	let reconnectTimer = null;
	let abortedByClient = false;

	const parseSSEBlock = (block) => {
		// Parse SSE-style block (lines like "data: ..." and optionally "event: ...")
		const lines = block.split(/\r?\n/);
		let event = 'message',
			data = null;
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith('event:')) {
				event = line.slice(6).trim();
			}
			else if (event === 'done' && line.startsWith('code:')) {
				let code = parseInt(line.slice(5).trim());
				if (code === 0) {
					// Successful execution
					return;
				}
				else {
					// Failed execution
					throw new Error(`Execution failed with code ${code}`);
				}
			}
			else if (line.startsWith('json:')) {
				let json = line.slice(5).trim();
				if (json.startsWith('{') && json.endsWith('}')) {
					event = 'data';
					data = JSON.parse(json);
				}
				else {
					dataLines.push(json);
				}
			}
			else if (line.startsWith('data:')) {
				dataLines.push(line.slice(5).trim());
			}
			else if (line.startsWith('stdout:')) {
				event = 'stdout';
				dataLines.push(line.slice(7).trim());
			}
			else if (line.startsWith('stderr:')) {
				event = 'stderr';
				dataLines.push(line.slice(7).trim());
			}
			else if (line.startsWith(':')) {
				event = 'comment';
				dataLines.push(line.slice(1).trim());
			}
		}

		if (data === null) {
			data = dataLines.join('\n');
		}

		if (event === 'error') {
			console.error(data);
		}

		if (messageHandler) {
			try {
				let ret = messageHandler(event, data);
				// Allow a return status from the handler to control if this stream should be aborted.
				if (ret === false) {
					abortedByClient = true;
					try { controller.abort(); } catch (e) {}
				}
			}
			catch (e) {
				console.error('messageHandler error', e);
			}
		}
	};

	const p = new Promise(async (resolve, reject) => {
		try {
			// Ensure streaming requests bypass the service worker by setting a special header.
			// Do not modify caller-provided headers object directly; clone it first.
			const reqHeaders = Object.assign({}, headers || {});
			reqHeaders['X-Bypass-Service-Worker'] = '1';
			reqHeaders['Cache-Control'] = 'no-cache';
			reqHeaders['Connection'] = 'keep-alive';

			const res = await fetch(url, {
				method: method,
				headers: reqHeaders,
				body: body,
				signal
			}).catch(e => {
				console.error(e);
				return null;
			});

			if (!res) {
				if (messageHandler) messageHandler('error', 'Fetch failed');
				return resolve();
			}

			if (!res.ok) {
				const text = await res.text();
				if (messageHandler) messageHandler('error', `[HTTP ${res.status}] ${text}`);
				return resolve();
			}

			// Stream the response body and parse SSE-like chunks
			const decoder = new TextDecoder();
			reader = res.body.getReader();
			let buffer = '';

			while (true) {
				if (!reader) break;
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

			return resolve();
		} catch (err) {
			if (err && err.name === 'AbortError') {
				if (messageHandler) messageHandler('close', 'Stream aborted by client.');
				return resolve();
			} else {
				if (messageHandler) messageHandler('error', err && err.message ? err.message : String(err));
				return reject();
			}
		} finally {
			// Cleanup reader
			if (reader) {
				try { await reader.cancel(); } catch (e) {}
				reader = null;
			}

			// Do not abort the controller here unconditionally; leave it for callers to inspect if needed.

			// Handle reconnect logic only if not aborted by client
			if (reconnect && !abortedByClient) {
				reconnectTimer = setTimeout(() => {
					// call the stream again; the returned promise is intentionally not chained
					try { stream(url, method, headers, body, messageHandler, reconnect); } catch (e) {}
				}, 15000);
			}
		}
	});

	// attach controller and cancel to the returned promise
	p.controller = controller;
	p.cancel = () => {
		abortedByClient = true;
		try { controller.abort(); } catch (e) {}
		// cancel reader if active
		if (reader) {
			try { reader.cancel(); } catch (e) {}
			reader = null;
		}
		// clear any pending reconnect
		if (reconnectTimer) {
			try { clearTimeout(reconnectTimer); } catch (e) {}
			reconnectTimer = null;
		}
	};

	return p;
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
	let line = document.createElement('div');
	line.classList.add('line-' + event);
	line.innerHTML = data;
	terminalOutput.appendChild(line);

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
		fetch(`/api/cron/${host}`, { method: 'GET' })
			.then(r => r.json())
			.then(data => {
				if (!data.success) {
					return reject(data);
				}

				const jobs = data.jobs || [];
				const job = jobs.find(j => j.identifier === identifier);

				if (target) {
					populateCronJob(job, target);
				}
				return resolve(job);
			})
			.catch(() => {
				// ignore fetch errors; show defaults
			});
	});
}

function populateCronJob(job, target) {
	let schedule, time, day;

	if (target) {
		schedule = target.querySelector('[name="schedule"]');
		time = target.querySelector('[name="time"]');
		day = target.querySelector('[name="weekly_day"]');
	}

	if (target && !target.dataset.autoEventsAdded) {
		// Add change event to schedule selector to show/hide relevant fields
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

	if (!job) {
		if (schedule) {
			let hasDisabled = false;
			schedule.querySelectorAll('option').forEach(option => {
				if (option.value === 'disabled') {
					hasDisabled = true;
				}
			});

			if (hasDisabled) {
				schedule.value = 'disabled';
			}
			else {
				schedule.value = 'hourly';
			}

			schedule.dispatchEvent(new CustomEvent('change'));
		}
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
	}
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

/**
 * Format a cron schedule string into a human-readable description.
 *
 * Input string should be in a cron format ie "0 2 * * 1"
 *
 * @param {string} schedule
 */
function formatCronSchedule(schedule) {
	if (!schedule) return 'Disabled';

	const s = String(schedule).trim();
	if (!s || s.toUpperCase() === 'DISABLED') return 'Disabled';

	// Handle @-shortcuts
	const shortcuts = {
		'@hourly': 'Hourly',
		'@daily': 'Daily',
		'@midnight': 'Daily at 00:00',
		'@weekly': 'Weekly',
		'@monthly': 'Monthly',
		'@yearly': 'Yearly',
		'@annually': 'Yearly',
		'@reboot': 'At reboot'
	};
	if (shortcuts[s.toLowerCase()]) return shortcuts[s.toLowerCase()];

	// Split into parts (minute hour dom month dow)
	const parts = s.split(/\s+/);
	if (parts.length < 5) return s;

	const [minute, hour, dom, month, dow] = parts;

	// Helper to map DOW numbers to names
	const dowMap = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday', '7': 'Sunday' };

	function prettyTime(h, m) {
		// h or m might be '*' or numbers
		if (h === '*' || m === '*') return null;
		const hh = String(h).padStart(2, '0');
		const mm = String(m).padStart(2, '0');
		return `${hh}:${mm}`;
	}

	// Common patterns
	// Every minute
	if (minute === '*' && hour === '*' && dom === '*' && month === '*' && dow === '*') return 'Every minute';

	// Every N minutes: */N * * * *
	if (/^\*\/\d+$/.test(minute) && hour === '*' && dom === '*' && month === '*' && dow === '*') {
		const n = minute.split('/')[1];
		return `Every ${n} minute${n !== '1' ? 's' : ''}`;
	}

	// Hourly (e.g., 0 * * * *) or minute fixed, hour = *
	if (hour === '*' && dom === '*' && month === '*' && dow === '*') {
		if (/^\d+$/.test(minute)) {
			return `Hourly at minute ${String(minute).padStart(2, '0')}`;
		}
		return 'Hourly';
	}

	// Daily (minute hour * * *)
	if (dom === '*' && month === '*' && dow === '*') {
		if (/^(\d+|\*+)$/.test(minute) && /^(\d+|\*+)$/.test(hour) && minute !== '*') {
			const t = prettyTime(hour, minute);
			if (t) return `Daily at ${t}`;
		}
		// Fallback
		return 'Daily';
	}

	// Weekly (minute hour * * DOW)
	if (dom === '*' && month === '*') {
		if (dow && dow !== '*') {
			// dow may be a list like 1,3
			const partsDow = String(dow).split(',');
			const mapped = partsDow.map(d => dowMap[d] || d);
			const t = prettyTime(hour, minute);
			if (mapped.length === 1) {
				return t ? `Every ${mapped[0]} at ${t}` : `Every ${mapped[0]}`;
			}
			return t ? `Every ${mapped.join(', ')} at ${t}` : `Every ${mapped.join(', ')}`;
		}
	}

	// Monthly (minute hour DOM * *)
	if (month === '*' && dow === '*') {
		if (dom && dom !== '*') {
			const t = prettyTime(hour, minute) || '';
			return `Monthly on day ${dom}${t ? ` at ${t}` : ''}`;
		}
	}

	// If we reach here, produce a sensible summary
	let summaryParts = [];
	if (minute && minute !== '*') summaryParts.push(`minute: ${minute}`);
	if (hour && hour !== '*') summaryParts.push(`hour: ${hour}`);
	if (dom && dom !== '*') summaryParts.push(`day-of-month: ${dom}`);
	if (month && month !== '*') summaryParts.push(`month: ${month}`);
	if (dow && dow !== '*') summaryParts.push(`day-of-week: ${dow}`);

	if (summaryParts.length === 0) return 'Every minute';

	return summaryParts.join(', ');
}

/**
 * Check if a given application on a given host has a specific option enabled.
 *
 * @param guid
 * @param host
 * @param option
 * @returns {*|boolean}
 */
function checkHostAppHasOption(guid, host, option) {
	const appData = getApplicationData(guid);

	if (!appData) {
		// App data not loaded yet or not found
		return false;
	}

	const appHostData = appData.installs.find(h => h.host === host);
	if (!appHostData) {
		// No specific host data for this host
		return false;
	}

	return appHostData.options && appHostData.options.includes(option);
}

function openModal(modal) {
	modal.classList.add('show');
	document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
	modal.classList.remove('show');
	document.body.style.overflow = '';
}

/**
 * Poll the server for a continuous feed of changes for a given service
 *
 * @param {string} app_guid
 * @param {string} host
 * @param {string} service
 */
function pollService(app_guid, host, service) {
	stream(`/api/service/stream/${app_guid}/${host}/${service}`, 'GET',{},null,(event, data) => {
		if (event === 'data') {
			let svcName = data.service || service;

			// Keep the application state consistent with latest data if it's the currently loaded service
			if (loadedService === svcName) {
				loadedServiceData = Object.assign(loadedServiceData, data);
			}

			// Dispatch the change notification so dependent functions can pick up on the new data.
			document.dispatchEvent(new CustomEvent('serviceChange', { detail: data }));
		}
	}, true);
}

/**
 * Poll the server for a continuous feed of changes for all hosts
 *
 */
function pollHostsMetrics() {
	stream(`/api/hosts/metrics/stream`, 'GET',{},null,(event, data) => {
		if (event === 'data') {
			// Notify the application that a change was detected.
			document.dispatchEvent(new CustomEvent('hostChange', {detail: data}));
		}
	}, true);
}

/**
 * Visually tick up/down the number in a given element.
 *
 * If the previous number was 1 and the new number is 10,
 * the values will be updated in the DOM to count up from 1 to 10.
 *
 * @param {Element} element
 * @param {number|string} value
 * @param {function|null} displayFormat
 */
function numberTick(element, value, displayFormat) {
	const prev = parseFloat(element.textContent.replace(/[^0-9.\-]/g, ''));
	const target = typeof value === 'number' ? value : parseFloat(value);
	const format = typeof displayFormat === 'function' ? displayFormat : (v) => v.toFixed(1);

	if (isNaN(prev) || isNaN(target) || prev === target) {
		element.textContent = format(target);
		return;
	}

	const step = (target - prev) / Math.max(Math.abs(target - prev), 10);
	let current = prev,
		interval;

	const tick = () => {
		current += step;
		if ((step > 0 && current >= target) || (step < 0 && current <= target)) {
			element.textContent = format(target);
			if (interval) {
				clearInterval(interval);
			}
			return;
		}
		element.textContent = format(current);
	};

	tick();
	interval = setInterval(tick, 100);
}


document.addEventListener('DOMContentLoaded', () => {
	// Add standard close events to Modals
	document.querySelectorAll('.modal-close').forEach(button => {
		button.addEventListener('click', (e) => {
			const modal = e.target.closest('.modal');
			if (modal) {
				closeModal(modal);
			}
		});
	});

	// Clicking outside the modal content also closes the modal
	document.querySelectorAll('.modal-overlay').forEach(overlay => {
		overlay.addEventListener('click', e => {
			const modal = e.target.closest('.modal');
			if (modal) {
				closeModal(modal);
			}
		});
	});

	// Pressing escape closes any open modals
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			document.querySelectorAll('.modal.show').forEach(modal => {
				closeModal(modal);
			});
		}
	});
});


// Register a basic service worker to allow controlled caching and to bypass streaming endpoints
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/service-worker.js').then(reg => {
			console.log('ServiceWorker registered', reg.scope);

			// If there's an updated worker waiting, ask it to skip waiting so it becomes active
			if (reg.waiting) {
				reg.waiting.postMessage({ type: 'SKIP_WAITING' });
			}

			reg.addEventListener('updatefound', () => {
				const newWorker = reg.installing;
				console.log('Service worker update found.');
				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed') {
						// A new worker is installed and waiting. Ask it to activate immediately.
						if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
					}
				});
			});

			// Listen for messages from the service worker
			navigator.serviceWorker.addEventListener('message', (evt) => {
				if (evt.data && evt.data.type === 'SW_ACTIVATED') {
					console.log('Service Worker activated, version:', evt.data.version);
					// Optionally reload the page to ensure the new SW controls it
					window.location.reload();
				}
			});

			// Check remote service-worker version and auto-update if changed
			(async () => {
				try {
					const resp = await fetch('/service-worker.js', { cache: 'no-store' });
					if (resp.ok) {
						const text = await resp.text();
						const m = text.match(/\bSW_VERSION\s*=\s*['"]([^'"]+)['"]/);
						if (m && m[1]) {
							const remoteVersion = m[1];
							const localVersion = localStorage.getItem('warlock_sw_version');
							if (localVersion !== remoteVersion) {
								console.log('Service worker version changed:', localVersion, '=>', remoteVersion);
								// Ask the registration to update (will fetch new SW file)
								try { await reg.update(); } catch (e) { console.warn('reg.update failed', e); }
								// If the new worker is already waiting, activate it
								if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
								// store the new version; activation handler will perform reload when ready
								localStorage.setItem('warlock_sw_version', remoteVersion);
							}
						}
					}
				} catch (e) {
					console.warn('Could not check service-worker version', e);
				}
			})();
		}).catch(err => {
			console.warn('ServiceWorker registration failed:', err);
		});
	});
}
