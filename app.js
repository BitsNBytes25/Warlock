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
 * @property {HostAppData[]} hosts List of hosts where the application is installed.
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

const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');
const fs = require('fs');
const yaml = require('js-yaml');
const NodeCacheStore = require('node-cache');
const cache = new NodeCacheStore();

const app = express();
const PORT = process.env.PORT || 3077;

// Load environment variables
require('dotenv').config();


/***************************************************************
 **               Common Functions
 ***************************************************************/

/**
 * Reload the environmental .env file, generally useful after changes are done
 */
const reloadEnv = () => {
    // Re-read .env file to get latest values
    delete require.cache[require.resolve('dotenv')];
    require('dotenv').config();
};

/**
 * Get the configured application runner hosts (IP addresses or hostnames)
 *
 * @returns {string[]}
 */
const getSSHHosts = () => {
    let hosts = process.env.HOSTS;
    if (hosts) {
        return hosts.split(',').map(h => h.trim());
    }
    else {
        return []
    }
};

/**
 * Generate an SSH command string to run a remote or local command
 * @param target
 * @param remoteCommand
 * @returns {string}
 */
const buildSSHCommand = (target, remoteCommand) => {
    const hosts = getSSHHosts();
    if (!hosts.includes(target)) {
        throw new Error(`Target host '${target}' is not in the configured HOSTS list.`);
    }

    if (target === 'localhost' || target === '127.0.0.1') {
        return remoteCommand; // No SSH needed for localhost
    }
    else {
        // Escape single quotes in the remote command to avoid breaking the SSH command
        remoteCommand = remoteCommand.replace(/'/g, "'\\''");
        return `ssh -o LogLevel=quiet -o StrictHostKeyChecking=no root@${target} '${remoteCommand}'`;
    }
};

/**
 * Run a command via SSH on the target host
 *
 * @param target {string}
 * @param cmd {string}
 * @param extraFields {*}
 * @returns {Promise<{stdout: string, stderr: string, extraFields: *}>}
 */
async function cmdRunner(target, cmd, extraFields = {}) {
    return new Promise((resolve, reject) => {
        const sshCommand = buildSSHCommand(target, cmd);

        console.debug('cmdRunner: Executing command on ' + target, sshCommand);
        exec(sshCommand, { timeout: 30000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
            if (error) {
                console.error('cmdRunner: Received error:', stderr || error);
                if (stderr) {
                    return reject({error: new Error(stderr), stdout, stderr, extraFields});
                }
                else {
                    return reject({error, stdout, stderr, extraFields});
                }
            }

            console.debug('cmdRunner:', stdout);
            resolve({ stdout, stderr, extraFields });
        });
    });
}

async function updateFilePermissions(target, filename, user = null, group = null) {
    return new Promise((resolve, reject) => {
        let cmd = null;
        if (user && group) {
            cmd = `chown ${user}:${group} "${filename}"`;
        }
        else {
            // If we do not have explicit user:group membership, just use the parent directory.
            cmd = `chown $(stat -c%U "$(dirname "${filename}")"):$(stat -c%U "$(dirname "${filename}")") "${filename}"`
        }
        cmdRunner(target, cmd)
            .then(() => {
                return resolve();
            })
            .catch(e => {
                return reject(e.error);
            });
    });
}

/**
 * Push a local file to a remote target via SCP
 * or copy locally if target is localhost
 *
 * @param {string} target Target hostname or IP address
 * @param {string} src Local source file, (usually within /tmp)
 * @param {string} dest Fully resolved pathname of target file
 * @returns {Promise<unknown>}
 */
async function filePushRunner(target, src, dest) {
    return new Promise((resolve, reject) => {
        let scpCommand = '';
        if (target === 'localhost' || target === '127.0.0.1') {
            scpCommand = `cp "${src}" "${dest}"`;
            console.debug('filePushRunner: Copying local file', dest);
        }
        else {
            scpCommand = `scp -o LogLevel=quiet -o StrictHostKeyChecking=no "${src}" root@${target}:"${dest}"`;
            console.debug('filePushRunner: Pushing file to ' + target, dest);
        }

        exec(scpCommand, { timeout: 120000, maxBuffer: 1024 * 1024 * 20 }, (error, stdout, stderr) => {
            if (error) {
                console.error('filePushRunner: Received error:', stderr || error);
                if (stderr) {
                    return reject(new Error(stderr));
                }
                else {
                    return reject(error);
                }
            }

            console.debug('filePushRunner: file transfer completed');
            // Now that the file is uploaded, ssh to the host to change the ownership to the correct user.
            // We have no way of knowing exactly which user should have access,
            // but we can guess based on the parent directory.
            updateFilePermissions(target, dest)
                .then(() => {
                    return resolve({ stdout, stderr });
                })
                .catch(e => {
                    return reject(e);
                });
        });
    });
}

// @todo Make filePullRunner which uses process.spawn to receive a remote file in its entirety.
// Use tar on remote server and tar on local server to drop contents into a local /tmp file for reading.

/**
 * Get all applications from /var/lib/warlock/*.app registration files
 * *
 * @returns {Promise<Object.<string, AppData>>}
 */
async function getAllApplications() {
    return new Promise((resolve, reject) => {
        const hosts = getSSHHosts(),
            appsFilePath = path.join(__dirname, 'Apps.yaml'),
            cmd = 'for file in /var/lib/warlock/*.app; do if [ -f "$file" ]; then echo "$(basename "$file" \'.app\'):$(cat "$file")"; fi; done';
        let applications = {},
            promises = [],
            cachedApplications = cache.get('all_applications');

        if (hosts.length === 0) {
            return reject(new Error('No hosts configured in HOSTS environment variable.'));
        }

        if (cachedApplications) {
            console.debug('getAllApplications: Returning cached application data');
            return resolve(cachedApplications);
        }


        // Open Apps.yaml and parse it for the list of applications
        if (fs.existsSync(appsFilePath)) {
            const fileContents = fs.readFileSync(appsFilePath, 'utf8');
            const data = yaml.load(fileContents);
            if (data) {
                data.forEach(item => {
                    applications[ item.guid ] = item;
                    applications[ item.guid ].hosts = [];
                });

                console.debug('getAllApplications: Application Definitions Loaded', applications);
            }
        }

        hosts.forEach(host => {
            promises.push(cmdRunner(host, cmd));
        });

        Promise.all(promises)
            .then(results => {
                results.forEach((result, index) => {
                    const target = hosts[index];
                    const stdout = result.stdout;

                    for (let line of stdout.split('\n')) {
                        if (line.trim()) {
                            let [guid, path] = line.split(':').map(s => s.trim()),
                                appData = {path: path.trim(), host: target};

                            // Add some data from the local apps definition if it's available
                            if (!applications[guid]) {
                                applications[guid] = {
                                    guid: guid,
                                    title: guid,
                                    description: 'No description available',
                                    hosts: []
                                };
                            }
                            applications[guid]['hosts'].push(appData);
                        }
                    }
                });

                // Cache the applications for 1 hour
                cache.set('all_applications', applications, 3600);
                return resolve(applications);
            });
    });
}

/**
 * Get the details of a single service on a given host
 *
 * @param appData {AppData}
 * @param hostData {HostAppData}
 * @returns {Promise<{services:Object.<{string}, ServiceData>, app:AppData, host:HostAppData}>}
 */
async function getServicesStatus(appData, hostData) {
    return new Promise((resolve, reject) => {

        const guid = appData.guid;

        let cachedServices = cache.get(`services_${guid}_${hostData.host}`);
        if (cachedServices) {
            return resolve({
                app: appData,
                host: hostData,
                services: cachedServices
            });
        }

        cmdRunner(hostData.host, `${hostData.path}/manage.py --get-services`)
            .then(result => {
                const appServices = JSON.parse(result.stdout);

                // Save this to cache for faster future lookups
                cache.set(`services_${guid}_${hostData.host}`, appServices, 10); // Cache for 10 seconds

                return resolve({
                    app: appData,
                    host: hostData,
                    services: appServices
                });
            })
            .catch(e => {
                return reject(new Error(`Error retrieving services for application '${guid}' on host '${hostData.host}': ${e.error.message}`));
            });
    });
}

/**
 * Get all services from all applications across all hosts
 *
 * @returns {Promise<[{service:ServiceData, app:AppData, host:HostAppData}]>}
 */
async function getAllServices() {
    return new Promise((resolve, reject) => {
        getAllApplications()
            .then(results => {
                let allLookups = [],
                    services = [];

                for (let guid in results) {
                    let app = results[guid];
                    for (let hostData of app.hosts) {
                        allLookups.push(getServicesStatus(app, hostData));
                    }
                }

                Promise.allSettled(allLookups)
                    .then(serviceResults => {
                        serviceResults.forEach(result => {
                            console.debug(result);
                            if (result.status === 'fulfilled') {
                                let appServices = result.value.services;
                                for (let svc of Object.values(appServices)) {
                                    // Merge extra fields into service data
                                    services.push({service: svc, app: result.value.app.guid, host: result.value.host} );
                                }
                            }
                        });

                        resolve(services);
                    });
            })
    });
}

/**
 *
 * @param host
 * @param guid
 * @param service
 * @returns {Promise<Object.<app: AppData, host: HostAppData, service: ServiceData>>}
 */
async function validateHostService(host, guid, service) {
    return new Promise((resolve, reject) => {
        getAllApplications()
            .then(applications => {
                const app = applications[guid] || null;
                let found = false;

                if (!app) {
                    return reject(new Error(`Application with GUID '${guid}' not found`));
                }

                app.hosts.forEach(hostData => {
                    if (hostData.host === host) {
                        found = true;

                        // Check if the service exists on the target host for this application
                        getServicesStatus(app, hostData)
                            .then(serviceResults => {
                                const svc = serviceResults.services[service] || null;

                                if (!svc) {
                                    reject(new Error(`Service '${service}' not found in application '${guid}' on host '${host}'`));
                                }

                                return resolve({
                                    app: app,
                                    host: hostData,
                                    service: svc
                                });
                            })
                            .catch(error => {
                                return reject(new Error(`Error retrieving services for application '${guid}' on host '${host}': ${error.message}`));
                            });
                    }

                    if (!found) {
                        // If the host is not found, we can immediately reject the lookup.
                        return reject(new Error(`Host '${host}' does not have application installed with GUID '${guid}'`));
                    }
                });
            });
    });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/***************************************************************
 **               Application/UI Endpoints
 ***************************************************************/

// Route to serve the main HTML page (legacy)
app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/service/configure/:guid/:host/:service', (req, res) => {
    validateHostService(req.params.host, req.params.guid, req.params.service)
        .then(() => {
            res.sendFile(path.join(__dirname, 'public', 'service_configure.html'));
        })
        .catch(error => {
            res.status(404).send(`Service configuration not found: ${error.message}`);
        });
});

// Route to serve the new SPA
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to serve navigation component
app.get('/components/nav', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'components', 'nav.html'));
});

// API endpoint to serve page fragments for SPA
app.get('/pages/:page', (req, res) => {
    const page = req.params.page;
    const allowedPages = ['dashboard', 'monitor', 'files', 'settings'];
    
    if (!allowedPages.includes(page)) {
        return res.status(404).send('Page not found');
    }
    
    // Map page names to file names
    const pageFiles = {
        'dashboard': 'index.html',
        'monitor': 'monitor.html',
        'files': 'files.html',
        'settings': 'settings.html'
    };
    
    res.sendFile(path.join(__dirname, 'public', pageFiles[page]));
});

// Monitor page route (legacy)
app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

// File browser page route (with no host selected)
app.get('/files', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'files_noserver.html'));
});

// File browser page route
app.get('/files/:host', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'files.html'));
});

// Settings page route (legacy)
app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});


/***************************************************************
 **                      API Endpoints
 ***************************************************************/

/**
 * Get all services and their stats
 *
 * Returns JSON data with success (True/False), output/error, and services {list}
 *
 */
app.get('/api/services', async (req, res) => {
    getAllServices()
        .then((services) => {
            return res.json({
                success: true,
                output: '',
                services: services
            });
        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.message,
                services: []
            });
        });
});

/**
 * Get a single service and its status from a given host and application GUID
 */
app.get('/api/service/:guid/:host/:service', async (req, res) => {
    validateHostService(req.params.host, req.params.guid, req.params.service)
        .then(dat => {
            return res.json({
                success: true,
                service: dat.service
            });
        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.message,
                service: []
            });
        });
});

/**
 * Get the configuration values and settings for a given service
 */
app.get('/api/service/:guid/:host/:service/configs', async (req, res) => {
    validateHostService(req.params.host, req.params.guid, req.params.service)
        .then(dat => {
            cmdRunner(dat.host.host, `${dat.host.path}/manage.py --service ${dat.service.service} --get-configs`)
                .then(result => {
                    return res.json({
                        success: true,
                        configs: JSON.parse(result.stdout)
                    });
                })
                .catch(e => {
                    return res.json({
                        success: false,
                        error: e.error.message,
                        service: []
                    });
                });
        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.message,
                service: []
            });
        });
});

app.post('/api/service/:guid/:host/:service/configs', async (req, res) => {
    validateHostService(req.params.host, req.params.guid, req.params.service)
        .then(dat => {
            const configUpdates = req.body;
            const updatePromises = [];
            for (let option in configUpdates) {
                const value = configUpdates[option];
                updatePromises.push(
                    cmdRunner(dat.host.host, `${dat.host.path}/manage.py --service ${dat.service.service} --set-config "${option}" "${value}"`)
                );
            }
            Promise.all(updatePromises)
                .then(result => {
                    return res.json({
                        success: true,
                    });
                })
                .catch(e => {
                    return res.json({
                        success: false,
                        error: e.error.message
                    });
                });
        });
})

/**
 * Get all available applications and which hosts each is installed on
 */
app.get('/api/applications', (req, res) => {
    getAllApplications()
        .then(applications => {
            return res.json({
                success: true,
                applications: applications
            });
        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.message,
                applications: []
            });
        });
});

/**
 * Helper method to facilitate /api/service/[start|stop|restart] endpoints
 *
 * @param action {string}
 * @param req {Request}
 * @param res {Response}
 * @returns {*}
 */
const serviceActionHandler = (action, req, res) => {
    const { guid, host, service } = req.body;

    if (!(host && guid && service && action)) {
        return res.json({
            success: false,
            error: 'Host, service, and action are required'
        });
    }

    const validActions = ['start', 'stop', 'restart'];
    if (!validActions.includes(action)) {
        return res.json({
            success: false,
            error: `Invalid action. Must be one of: ${validActions.join(', ')}`
        });
    }

    validateHostService(host, guid, service)
        .then(dat => {
            cmdRunner(host, `systemctl ${action} ${service}`)
                .then(result => {
                    return res.json({
                        success: true,
                        output: result.stdout,
                        stderr: result.stderr
                    });
                })
                .catch(e => {
                    return res.json({
                        success: false,
                        error: e.error.message
                    });
                });
        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.message
            });
        });
}
// Service control endpoint (start/stop/restart) - now works with all applications dynamically
app.post('/api/service/start', async (req, res) => {
    serviceActionHandler('start', req, res);
});
app.post('/api/service/stop', async (req, res) => {
    serviceActionHandler('stop', req, res);
});
app.post('/api/service/restart', async (req, res) => {
    serviceActionHandler('restart', req, res);
});

/**
 * API endpoint to get all enabled hosts and their general information
 */
app.get('/api/hosts', async (req, res) => {
    let promises = [];
    const hosts = getSSHHosts();
    hosts.forEach(host => {
        // In one SSH session, retrieve the device hostname, mounted disks and their free/used space,
        // and OS name and version.
        promises.push(
            cmdRunner(
                host,
                'echo "HOSTNAME: $(hostname -f)"; ' +
                'echo "KERNEL: $(uname -a)"; ' +
                'echo "OS_INFO:"; ' +
                'lsb_release -a; ' +
                'echo "DISK_INFO:"; ' +
                'df --output=source,fstype,used,avail,target -x tmpfs -x devtmpfs -x squashfs -x efivarfs',
                { host: host }
            )
        );
    });

    Promise.allSettled(promises)
        .then(results => {
            let ret = {};
            results.forEach(result => {

                console.log(result);

                let hostInfo = {
                    connected: false,
                    hostname: '',
                    os: {
                        name: '',
                        title: '',
                        version: '',
                    },
                    disks: []
                },
                    host = null;

                if (result.status === 'fulfilled') {
                    const lines = result.value.stdout.split('\n');
                    let group = null;

                    hostInfo.connected = true;
                    host = result.value.extraFields.host;
                    lines.forEach(line => {
                        if (line.startsWith('HOSTNAME:')) {
                            hostInfo.hostname = line.replace('HOSTNAME:', '').trim();
                            group = null;
                        }
                        else if (line === 'DISK_INFO:') {
                            group = 'disks';
                        }
                        else if (line === 'OS_INFO:') {
                            group = 'os';
                        }
                        else if (group === 'disks' && !line.startsWith('Filesystem')) {
                            const parts = line.trim().split(/\s+/);
                            if (parts.length === 5) {
                                hostInfo.disks.push({
                                    filesystem: parts[0],
                                    fstype: parts[1],
                                    used: parseInt(parts[2]) * 1024,
                                    avail: parseInt(parts[3]) * 1024,
                                    size: (parseInt(parts[2]) + parseInt(parts[3])) * 1024,
                                    mountpoint: parts[4]
                                });
                            }
                        }
                        else if (group === 'os' && line.startsWith('Description:')) {
                            hostInfo.os.title = line.replace('Description:', '').trim();
                        }
                        else if (group === 'os' && line.startsWith('Release:')) {
                            hostInfo.os.version = line.replace('Release:', '').trim();
                        }
                        else if (group === 'os' && line.startsWith('Distributor ID:')) {
                            hostInfo.os.name = line.replace('Distributor ID:', '').trim().toLowerCase();
                        }
                    });
                }
                else {
                    host = result.reason.extraFields.host;
                }

                if (host) {
                    ret[host] = hostInfo;
                }
            });

            return res.json({
                success: true,
                hosts: ret
            });
        });
});

app.get('/service-config', async (req, res) => {
    const { guid, host, service } = req.body;

    if (!(host && guid && service)) {
        return res.json({
            success: false,
            error: 'Host, service, and action are required'
        });
    }

    validateHostService(host, guid, service)
        .then(dat => {
            cmdRunner(host, `${dat.host.path}/manage.py --service ${service} --get-configs`)
                .then(result => {
                    return res.json({
                        success: true,
                        configs: JSON.parse(result.stdout),
                        output: result.stdout,
                        stderr: result.stderr
                    });
                })
                .catch(e => {
                    return res.json({
                        success: false,
                        error: e.error.message
                    });
                });
        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.message
            });
        });
});

// Legacy endpoint for backward compatibility
app.post('/run-ssh-command', (req, res) => {
    const sshCommand = buildSSHCommand('/home/steam/VEIN/manage.py --help');
    
    console.log('Executing legacy SSH command:', sshCommand);
    
    exec(sshCommand, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('SSH command error:', error);
            return res.json({
                success: false,
                command: sshCommand,
                output: `Error: ${error.message}`,
                stderr: stderr || ''
            });
        }
        
        res.json({
            success: true,
            command: sshCommand,
            output: stdout || 'Command executed successfully (no output)',
            stderr: stderr || ''
        });
    });
});

// Global variable to store htop process
let bpytopProcess = null;
let bpytopOutput = '';

// Start htop monitoring
app.post('/start-bpytop', (req, res) => {
    if (bpytopProcess) {
        return res.json({
            success: true,
            output: 'htop is already running'
        });
    }

    console.log('Starting system monitoring...');
    
    // Start continuous monitoring with system commands that work better for web display
    function updateSystemStats() {
        if (!bpytopProcess) return; // Stop if monitoring was stopped
        
        const monitorCommand = buildSSHCommand(`
echo "=== WARLOCK SYSTEM MONITOR ==="
echo "Timestamp: $(date)"
echo ""
echo "=== CPU INFORMATION ==="
lscpu | grep -E "Model name|CPU MHz|CPU\\(s\\):"
echo ""
echo "=== MEMORY USAGE ==="
free -h
echo ""
echo "=== DISK USAGE ==="
df -h | head -10
echo ""
echo "=== LOAD AVERAGE ==="
uptime
echo ""
echo "=== TOP PROCESSES (CPU) ==="
ps aux --sort=-%cpu | head -10
echo ""
echo "=== TOP PROCESSES (MEMORY) ==="
ps aux --sort=-%mem | head -10
echo ""
echo "=== NETWORK INTERFACES ==="
ip addr show | grep -E "inet |UP|DOWN" | head -10
echo ""
echo "=== ACTIVE CONNECTIONS ==="
ss -tuln | head -10
`);
        
        exec(monitorCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('Monitor command error:', error);
                bpytopOutput = `Error retrieving system stats: ${error.message}\n`;
                return;
            }
            
            bpytopOutput = stdout;
        });
    }
    
    // Mark as running and start periodic updates
    bpytopProcess = { active: true }; // Simple object to track if monitoring is active
    bpytopOutput = 'Initializing system monitoring...\n';
    
    // Update immediately, then every 3 seconds
    updateSystemStats();
    const monitorInterval = setInterval(updateSystemStats, 3000);
    
    // Store interval ID so we can clear it later
    bpytopProcess.intervalId = monitorInterval;
    
    res.json({
        success: true,
        output: 'System monitoring started successfully'
    });
});

// Get current htop output
app.get('/bpytop-output', (req, res) => {
    res.json({
        success: true,
        output: bpytopOutput,
        isRunning: bpytopProcess !== null
    });
});

// Stop system monitoring
app.post('/stop-bpytop', (req, res) => {
    if (bpytopProcess) {
        if (bpytopProcess.intervalId) {
            clearInterval(bpytopProcess.intervalId);
        }
        bpytopProcess = null;
        bpytopOutput = 'System monitoring stopped.\n';
    }
    
    res.json({
        success: true,
        output: 'System monitoring stopped'
    });
});


// File browser endpoints
app.get('/api/files/:host', (req, res) => {
    const requestedPath = req.query.path || '/root';
    const host = req.params.host;

    if (!getSSHHosts().includes(host)) {
        return res.json({
            success: false,
            error: 'Requested host is not in the configured HOSTS list'
        });
    }
    
    if (!requestedPath) {
        return res.json({
            success: false,
            error: 'Path is required'
        });
    }
    
    console.log('Browsing directory:', requestedPath);

    // Use ls with detailed output to get file information
    // -la shows all details including symlinks
    //let cmd = `ls -la "${requestedPath}" | tail -n +2`;
    let cmd = `P="${requestedPath}"; ` +
        'ls -1 "$P" | while read F; do ' +
        'P="${P%/}"; ' +
        '[ -h "$P/$F" ] && FP="$(readlink -f "$P/$F")" || FP="$P/$F";' +
        '[ -h "$P/$F" ] && SL="true" || SL="false";' +
        '[ -f "$FP" ] && [ -r "$FP" ] && S="$(stat -L -c%s "$FP")" || S="null";' +
        '[ -r "$FP" ] && M="$(file --mime-type "$FP" | sed "s#.*: ##")" || M="";' +
        '[ -r "$FP" ] && PERMS="$(stat -c%a "$FP")" || PERMS="null";' +
        'U="$(stat -c%U "$FP")";' +
        'G="$(stat -c%G "$FP")";' +
        '[ -r "$FP" ] && MTIME="$(stat -c%Y "$FP")" || MTIME="null";' +
        `echo "{\\"name\\":\\"$F\\",\\"mimetype\\":\\"$M\\",\\"path\\":\\"$FP\\",\\"size\\":$S,\\"symlink\\":$SL,\\"permissions\\":$PERMS,\\"user\\":\\"$U\\",\\"group\\":\\"$G\\",\\"modified\\":$MTIME},";` +
        'done;';
    cmdRunner(host, cmd)
        .then(result => {
            // Resulting code will be _almost_ JSON compatible, just strip the trailing comma and wrap in []
            let jsonOutput = `[${result.stdout.trim().replace(/,$/, '')}]`;
            let files = [];
            try {
                files = JSON.parse(jsonOutput);
            } catch (e) {
                return res.json({
                    success: false,
                    error: 'Failed to parse directory listing'
                });
            }

            res.json({
                success: true,
                files: files,
                path: requestedPath
            });
        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.error.message
            });
        });
});

// File viewing endpoint
app.get('/api/file/:host', (req, res) => {
    const filePath = req.query.path || null;
    const host = req.params.host;

    if (!getSSHHosts().includes(host)) {
        return res.json({
            success: false,
            error: 'Requested host is not in the configured HOSTS list'
        });
    }
    
    if (!filePath) {
        return res.json({
            success: false,
            error: 'File path is required'
        });
    }
    
    console.log('Viewing file:', filePath);
    
    // First check if it's a text file and get its size
    cmdRunner(host, `[ -h "${filePath}" ] && F="$(readlink "${filePath}")" || F="${filePath}"; file --mime-type "$F" && stat -c%s "$F" && echo "$F"`)
        .then(result => {
            let lines = result.stdout.trim().split('\n'),
                mimetype = lines[0] || '',
                encoding = null,
                cmd = null,
                filesize = parseInt(lines[1]) || 0,
                filename = lines[2] || '';

            if (mimetype) {
                mimetype = mimetype.split(':').pop().trim();
            }

            if (filesize <= 1024 * 1024 * 10) {
                if (mimetype.startsWith('text/') || mimetype === 'application/json' || mimetype === 'application/xml') {
                    cmd = `cat "${filePath}"`;
                    encoding = 'raw';
                } else if (mimetype.startsWith('image/') || mimetype.startsWith('video/')) {
                    // For images/videos, return base64 encoding
                    cmd = `base64 "${filePath}"`;
                    encoding = 'base64';
                }
            }

            // Read the file content
            if (cmd) {
                cmdRunner(host, cmd)
                    .then(result => {
                        return res.json({
                            success: true,
                            content: result.stdout,
                            encoding: encoding,
                            mimetype: mimetype,
                            size: filesize,
                            path: filename,
                            name: path.basename(filePath),
                        });
                    })
                    .catch(e => {
                        return res.json({
                            success: false,
                            error: 'Cannot read file content'
                        });
                    });
            }
            else {
                return res.json({
                    success: true,
                    content: null,
                    encoding: encoding,
                    mimetype: mimetype,
                    size: filesize,
                    path: filename,
                    name: path.basename(filePath),
                })
            }

        })
        .catch(e => {
            return res.json({
                success: false,
                error: e.error.message
            });
        });
});

/**
 * Save file contents to a given path on the target host
 */
app.post('/api/file/:host', (req, res) => {
    const params = req.body,
        host = req.params.host;

    let path = params.path || null,
        content = params.content || null,
        name = params.name || null;

    // Sanity checks
    try {
        if (!getSSHHosts().includes(host)) {
            throw new Error('Requested host is not in the configured HOSTS list');
        }

        if (!path) {
            throw new Error('Please enter a file path');
        }

        if (name) {
            // Allow the user to submit a path + name separately so we can validate the name
            ['"', "'", '/', '\\', '?', '%', '*', ':', '|', '<', '>'].forEach(char => {
                if (name.includes(char)) {
                    throw new Error(`The file name cannot contain the following characters: " ' / \\ ? % * : | < >`);
                }
            });
        }

        ['"', "'", '\\', '?', '%', '*', ':', '|', '<', '>'].forEach(char => {
            if (path.includes(char)) {
                throw new Error(`The file path cannot contain the following characters: " ' \\ ? % * : | < >`);
            }
        });
    }
    catch (e) {
        return res.json({
            success: false,
            error: e.message
        });
    }

    if (name) {
        // If name and path are requested separately, combine them to perform file operations.
        path = path.replace(/\/+$/,'') + '/' + name;
    }


    if (content) {
        // Content was requested, save to a local /tmp file to transfer to the target server
        console.log('Saving file:', path);

        // Create a temporary file on the server with the content and then move it
        const tempFile = `/tmp/warlock_edit_${Date.now()}.tmp`;
        fs.writeFileSync(tempFile, content, 'utf8');

        // Push the temporary file to the target device
        filePushRunner(host, tempFile, path)
            .then(() => {
                console.log('File saved successfully:', path);
                res.json({
                    success: true,
                    message: 'File saved successfully'
                });
            })
            .catch(error => {
                console.error('Save file error:', error);
                return res.json({
                    success: false,
                    error: `Cannot save file: ${error.message}`
                });
            })
            .finally(() => {
                // Remove the temporary file
                fs.unlinkSync(tempFile);
            });
    }
    else {
        // No content supplied, that's fine!  We can still create an empty file.
        cmdRunner(host, `touch "${path}"`)
            .then(() => {
                console.debug('File created successfully:', path);
                // Update file permissions to try to keep them consistent
                updateFilePermissions(host, path)
                    .then(() => {
                        res.json({
                            success: true,
                            message: 'File saved successfully'
                        });
                    })
                    .catch(e => {
                        console.error('Update permissions error:', e);
                        return res.json({
                            success: false,
                            error: `File created but failed to update permissions: ${e.message}`
                        });
                    });
            })
            .catch(e => {
                console.error('Create file error:', e);
                return res.json({
                    success: false,
                    error: `Cannot create file: ${e.error.message}`
                });
            });
    }
});

// @todo Add a PUT method to push a binary file to the target host.



// Enhanced system monitoring endpoint
app.post('/enhanced-monitor', (req, res) => {
    console.log('Getting enhanced system stats...');
    
    const monitorCommand = buildSSHCommand(`
echo "SYSTEM_STATS_START"

echo "CPU_USAGE:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk "{print 100 - \\$1}" | head -1

echo "MEMORY_STATS:"
free | grep "^Mem:" | tr -s " " | cut -d" " -f3,2

echo "STORAGE_STATS:"
df -h / | tail -1 | awk "{print \\$3, \\$4, \\$5}"

echo "LOAD_AVERAGE:"
uptime | awk -F"load average:" "{print \\$2}" | sed "s/^[[:space:]]*//" | sed "s/[[:space:]]*$//"

echo "CPU_INFO:"
nproc

echo "NETWORK_STATS:"
cat /proc/net/dev | grep -v "lo:" | awk "NR>2 {rx+=\\$2; tx+=\\$10} END {print rx, tx}"

echo "CONNECTIONS:"
ss -tuln | wc -l

echo "TOP_CPU_PROCESSES:"
ps aux --sort=-%cpu | head -6 | tail -5 | awk "{print \\$11, \\$3}"

echo "TOP_MEMORY_PROCESSES:"
ps aux --sort=-%mem | head -6 | tail -5 | awk "{print \\$11, \\$4}"

echo "SYSTEM_STATS_END"
`);
    
    exec(monitorCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Enhanced monitor error:', error);
            return res.json({
                success: false,
                error: error.message
            });
        }
        
        try {
            const lines = stdout.trim().split('\n');
            const stats = {};
            let currentSection = '';
            
            lines.forEach(line => {
                line = line.trim();
                if (line.endsWith(':')) {
                    currentSection = line.slice(0, -1);
                    stats[currentSection] = [];
                } else if (line && currentSection) {
                    stats[currentSection].push(line);
                }
            });
            
            res.json({
                success: true,
                stats: stats
            });
        } catch (parseError) {
            console.error('Parse error:', parseError);
            res.json({
                success: false,
                error: 'Failed to parse system stats'
            });
        }
    });
});

// Create folder endpoint
app.post('/create-folder', (req, res) => {
    const { path: folderPath } = req.body;
    
    if (!folderPath) {
        return res.json({
            success: false,
            error: 'Folder path is required'
        });
    }
    
    console.log('Creating folder:', folderPath);
    
    const createCommand = buildSSHCommand(`mkdir -p "${folderPath}" && echo "Folder created successfully"`);
    
    exec(createCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Create folder error:', error);
            return res.json({
                success: false,
                error: `Cannot create folder: ${error.message}`
            });
        }
        
        if (stderr && stderr.trim()) {
            console.error('Create folder stderr:', stderr);
            return res.json({
                success: false,
                error: `Create error: ${stderr.trim()}`
            });
        }
        
        console.log('Folder created successfully:', folderPath);
        res.json({
            success: true,
            message: 'Folder created successfully'
        });
    });
});

// Rename file or folder endpoint
app.post('/rename-item', (req, res) => {
    const { oldPath, newPath, isDirectory } = req.body;
    
    if (!oldPath || !newPath) {
        return res.json({
            success: false,
            error: 'Old path and new path are required'
        });
    }
    
    console.log('Renaming item:', oldPath, '->', newPath);
    
    // Use mv command to rename
    const renameCommand = buildSSHCommand(`mv "${oldPath}" "${newPath}" && echo "Renamed successfully"`);
    
    exec(renameCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Rename error:', error);
            return res.json({
                success: false,
                error: `Cannot rename item: ${error.message}`
            });
        }
        
        if (stderr && stderr.trim()) {
            console.error('Rename stderr:', stderr);
            return res.json({
                success: false,
                error: `Rename error: ${stderr.trim()}`
            });
        }
        
        console.log('Item renamed successfully:', oldPath, '->', newPath);
        res.json({
            success: true,
            message: 'Item renamed successfully'
        });
    });
});

// Delete file or folder endpoint
app.post('/delete-item', (req, res) => {
    const { path: itemPath, isDirectory } = req.body;
    
    if (!itemPath) {
        return res.json({
            success: false,
            error: 'Item path is required'
        });
    }
    
    console.log('Deleting item:', itemPath, 'isDirectory:', isDirectory);
    
    // Use rm -rf for directories, rm for files
    const deleteCommand = isDirectory 
        ? buildSSHCommand(`rm -rf "${itemPath}" && echo "Deleted successfully"`)
        : buildSSHCommand(`rm -f "${itemPath}" && echo "Deleted successfully"`);
    
    exec(deleteCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Delete error:', error);
            return res.json({
                success: false,
                error: `Cannot delete item: ${error.message}`
            });
        }
        
        if (stderr && stderr.trim()) {
            console.error('Delete stderr:', stderr);
            return res.json({
                success: false,
                error: `Delete error: ${stderr.trim()}`
            });
        }
        
        console.log('Item deleted successfully:', itemPath);
        res.json({
            success: true,
            message: isDirectory ? 'Folder deleted successfully' : 'File deleted successfully'
        });
    });
});

// Recursive file search endpoint
app.post('/search-files', (req, res) => {
    const { path, query } = req.body;
    
    if (!path || !query) {
        return res.json({
            success: false,
            error: 'Path and search query are required'
        });
    }
    
    console.log('Searching for:', query, 'in path:', path);
    
    // Use find command to search recursively
    // -iname for case-insensitive search
    // -type f for files, -type d for directories
    // Use both to find files and folders
    // Exclude hidden files with ! -name ".*"
    const searchCommand = buildSSHCommand(`
        cd "${path}" 2>/dev/null || exit 1
        find . -maxdepth 10 \\( -type f -o -type d \\) ! -name ".*" -iname "*${query}*" 2>/dev/null | while read item; do
            fullpath="${path}/\${item#./}"
            if [ -d "$fullpath" ]; then
                echo "DIR|\$fullpath|\$(basename "$fullpath")"
            else
                size=\$(stat -c %s "$fullpath" 2>/dev/null || echo 0)
                echo "FILE|\$fullpath|\$(basename "$fullpath")|\$size"
            fi
        done | head -100
    `);
    
    exec(searchCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Search error:', error);
            return res.json({
                success: false,
                error: `Search failed: ${error.message}`
            });
        }
        
        const results = [];
        const lines = stdout.trim().split('\n').filter(line => line);
        
        lines.forEach(line => {
            const parts = line.split('|');
            if (parts.length >= 3) {
                const type = parts[0] === 'DIR' ? 'directory' : 'file';
                const path = parts[1];
                const name = parts[2];
                const size = parts[3] ? parseInt(parts[3]) : 0;
                
                results.push({
                    type: type,
                    path: path,
                    name: name,
                    size: size,
                    permissions: '-'
                });
            }
        });
        
        console.log(`Found ${results.length} results for "${query}"`);
        res.json({
            success: true,
            results: results,
            count: results.length
        });
    });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/tmp/');
    },
    filename: (req, file, cb) => {
        cb(null, `warlock_upload_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Upload file endpoint
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.json({
            success: false,
            error: 'No file uploaded'
        });
    }
    
    const targetPath = req.body.path;
    const targetFile = `${targetPath}/${req.file.originalname}`;
    const tempFile = req.file.path;
    
    console.log('Uploading file:', req.file.originalname, 'to:', targetFile);
    
    // Transfer file to remote server
    const uploadCommand = `scp "${tempFile}" root@45.26.230.248:"${targetFile}" && rm -f "${tempFile}"`;
    
    exec(uploadCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Upload file error:', error);
            // Clean up temp file
            exec(`rm -f "${tempFile}"`, () => {});
            return res.json({
                success: false,
                error: `Cannot upload file: ${error.message}`
            });
        }
        
        console.log('File uploaded successfully:', targetFile);
        res.json({
            success: true,
            message: 'File uploaded successfully'
        });
    });
});

// Settings endpoints
app.get('/get-settings', (req, res) => {
    try {
        const settings = getSSHConfig();
        res.json({
            success: true,
            settings: settings
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.post('/save-settings', (req, res) => {
    const { SSH_USER, SSH_HOST } = req.body;
    
    if (!SSH_USER || !SSH_HOST) {
        return res.json({
            success: false,
            error: 'SSH_USER and SSH_HOST are required'
        });
    }
    
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    // Read existing .env file if it exists
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add SSH_USER
    if (envContent.includes('SSH_USER=')) {
        envContent = envContent.replace(/SSH_USER=.*/g, `SSH_USER=${SSH_USER}`);
    } else {
        envContent += `\nSSH_USER=${SSH_USER}`;
    }
    
    // Update or add SSH_HOST
    if (envContent.includes('SSH_HOST=')) {
        envContent = envContent.replace(/SSH_HOST=.*/g, `SSH_HOST=${SSH_HOST}`);
    } else {
        envContent += `\nSSH_HOST=${SSH_HOST}`;
    }
    
    try {
        fs.writeFileSync(envPath, envContent.trim() + '\n');
        
        // Reload environment variables to pick up the new settings
        delete require.cache[require.resolve('dotenv')];
        require('dotenv').config();
        
        console.log('Settings saved to .env file and reloaded');
        const newConfig = getSSHConfig();
        console.log(`New SSH Configuration: ${newConfig.SSH_USER}@${newConfig.SSH_HOST}`);
        
        res.json({
            success: true,
            message: 'Settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.json({
            success: false,
            error: `Failed to save settings: ${error.message}`
        });
    }
});

app.post('/test-connection', (req, res) => {
    const { SSH_USER, SSH_HOST } = req.body;
    
    if (!SSH_USER || !SSH_HOST) {
        return res.json({
            success: false,
            error: 'SSH_USER and SSH_HOST are required'
        });
    }
    
    const testCommand = `ssh ${SSH_USER}@${SSH_HOST} 'echo "Connection successful"'`;
    
    exec(testCommand, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Connection test failed:', error);
            return res.json({
                success: false,
                error: `Connection failed: ${error.message}`
            });
        }
        
        if (stdout.includes('Connection successful')) {
            res.json({
                success: true,
                message: 'Connection test successful'
            });
        } else {
            res.json({
                success: false,
                error: 'Unexpected response from server'
            });
        }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});