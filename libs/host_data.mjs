import {cmdRunner} from "./cmd_runner.mjs";
import {AppInstallData} from "./app_install_data.mjs";
import {logger} from "./logger.mjs";
import {HostMetric} from "../db.js";

/**
 * @property {string}   this.host            Hostname or IP of this host, as set from Warlock config
 * @property {string}   this.public_ip       Public IP address of this host
 * @property {string}   this.hostname        Hostname of this host
 * @property {string}   this.os.name         Name of the OS
 * @property {string}   this.os.title        Title of the OS
 * @property {string}   this.os.version      Version of the OS
 * @property {string}   this.os.kernel       Kernel version of the OS
 * @property {string}   this.cpu.model       Model of the CPU
 * @property {number}   this.cpu.threads     Number of threads
 * @property {number}   this.cpu.cores       Total number of cores
 * @property {number}   this.cpu.sockets     Number of physical CPUs
 * @property {number}   this.memory          Total amount of memory in bytes
 * @property {Object[]} this.disks           Array of disk objects
 * @property {string}   this.disks[].dev     Filesystem name
 * @property {string}   this.disks[].type    Filesystem type
 * @property {string}   this.disks[].mount   Mount point of the disk
 * @property {string[]} this.nics            Array of network interface names
 */
export class HostData {
	constructor(host) {
		this.host = host;
		this.public_ip = null;
		this.hostname = host;
		this.firewall = 'none';
		this.os = {
			name: null,
			title: null,
			version: null,
			kernel: null,
		};
		this.cpu = {
			model: null,
			threads: null,
			cores: null,
			sockets: null,
		};
		this.metrics = {
			connected: false,
		};
		this.memory = null;
		this.disks = [];
		this.nics = [];
	}

	async init() {
		const firewallChecks = [
			'echo -n ufw:; which ufw >/dev/null && ufw status | head -n1 || echo "Status: NOT INSTALLED"; ',
			'echo -n firewalld:; which firewall-cmd >/dev/null && firewall-cmd --state 2>/dev/null || echo "Status: NOT INSTALLED"; '
		];
		return cmdRunner(
			this.host,
			'echo "HOSTNAME: $(hostname -f)"; ' +
			'echo "KERNEL: $(uname -r)"; ' +
			'echo "THREAD_COUNT: $(nproc)"; ' +
			'echo "PUBLIC_IPV4: $(curl -4 -s ifconfig.me 2>/dev/null || wget -qO- ifconfig.me 2>/dev/null || echo)"; ' +
			'echo "CPU_COUNT: $(egrep "^physical id" /proc/cpuinfo | uniq | wc -l)"; ' +
			'echo "CPU_CORES: $(egrep "^cpu cores" /proc/cpuinfo | head -n1 | sed "s#.*: ##")"; ' +
			'echo "CPU_MODEL: $(egrep "^model name" /proc/cpuinfo | head -n1 | sed "s#.*: ##")"; ' +
			'echo "MEMORY_STATS: $(free | grep "^Mem:" | tr -s " " | cut -d" " -f2)"; ' +
			'echo "OS_INFO:"; lsb_release -a; ' +
			'echo "DISK_INFO:"; df --output=source,fstype,target -x tmpfs -x devtmpfs -x squashfs -x efivarfs; ' +
			'echo "NET_INFO:"; cat /proc/net/dev | grep -v "lo:" | grep ":" | sed "s#:.*##"; ' +
			'echo "FIREWALL:"; ' + firewallChecks.join(' '),
			86400, 'overview'
		)
			.then(result => {
				const lines = result.stdout.split('\n');
				let group = null;

				lines.forEach(line => {
					if (line.startsWith('HOSTNAME:')) {
						this.hostname = line.replace('HOSTNAME:', '').trim();
						group = null;
					}
					else if (group === null && line.startsWith('THREAD_COUNT: ')) {
						this.cpu.threads = parseInt(line.replace('THREAD_COUNT:', '').trim());
					}
					else if (group === null && line.startsWith('PUBLIC_IPV4: ')) {
						this.public_ip = line.replace('PUBLIC_IPV4:', '').trim();
					}
					else if (group === null && line.startsWith('CPU_COUNT: ')) {
						this.cpu.sockets = parseInt(line.replace('CPU_COUNT:', '').trim());
					}
					else if (group === null && line.startsWith('CPU_MODEL: ')) {
						this.cpu.model = line.replace('CPU_MODEL:', '').trim();
					}
					else if (group === null && line.startsWith('CPU_CORES: ')) {
						this.cpu.cores = parseInt(line.replace('CPU_CORES:', '').trim());
					}
					else if (group === null && line.startsWith('MEMORY_STATS: ')) {
						const memParts = line.replace('MEMORY_STATS:', '').trim();
						this.memory = parseInt(memParts) * 1024;
					}
					else if (group === null && line.startsWith('KERNEL: ')) {
						this.os.kernel = line.replace('KERNEL:', '').trim();
					}
					else if (line === 'DISK_INFO:') {
						group = 'disks';
					}
					else if (line === 'OS_INFO:') {
						group = 'os';
					}
					else if (line === 'NET_INFO:') {
						group = 'nics';
					}
					else if (line === 'FIREWALL:') {
						group = 'firewall';
						// Clear the status of the firewall on header; it'll be set on the next line or two.
						this.firewall = 'none';
					}
					else if (group === 'disks' && !line.startsWith('Filesystem')) {
						const parts = line.trim().split(/\s+/);
						if (parts.length === 3) {
							this.disks.push({
								dev: parts[0],
								type: parts[1],
								mount: parts[2]
							});
						}
					}
					else if (group === 'os' && line.startsWith('Description:')) {
						this.os.title = line.replace('Description:', '').trim();
					}
					else if (group === 'os' && line.startsWith('Release:')) {
						this.os.version = line.replace('Release:', '').trim();
					}
					else if (group === 'os' && line.startsWith('Distributor ID:')) {
						this.os.name = line.replace('Distributor ID:', '').trim().toLowerCase();
					}
					else if (group === 'nics') {
						const val = line.trim();
						if (val) {
							this.nics.push(line.trim());
						}
					}
					else if (group === 'firewall') {
						// Example output for firewall lines:
						// ufw:Status: active
						// ufw:Status: inactive
						// ufw:Status: NOT INSTALLED
						// firewalld:running
						// firewalld:inactive
						// firewalld:Status: NOT INSTALLED
						const parts = line.split(':');
						if (parts.length >= 2) {
							const key = parts[0].trim().toLowerCase();
							const restOfLine = parts.slice(1).join(':').trim();
							if (key === 'ufw' && restOfLine === 'Status: active') {
								this.firewall = 'ufw';
							}
							else if (key === 'firewalld' && restOfLine === 'running') {
								this.firewall = 'firewalld';
							}
						}
					}
				});

				// Number of cores will be *per socket*, so to get the total number, multiply the two
				if (this.cpu.sockets && this.cpu.cores) {
					this.cpu.cores = this.cpu.sockets * this.cpu.cores;
				}

				// Received data!  This means it's connected.
				this.metrics.connected = true;
			})
			.catch(error => {
				logger.error(`Failed to retrieve host data for ${this.host}: ${error.message}`);
				this.metrics.connected = false;
			});
	}

	/**
	 * Get live metrics for this host
	 *
	 * @returns {Promise<Object>}
	 */
	async getMetrics() {
		return cmdRunner(
			this.host,
			'echo "UPTIME: $(uptime)"; ' +
			'echo "THREAD_COUNT: $(nproc)"; ' +
			'echo "MEMORY_STATS: $(free | grep "^Mem:" | tr -s " " | cut -d" " -f2,3,4,5,6,7)"; ' +
			'echo "DISK_INFO:"; df --output=source,used,avail -x tmpfs -x devtmpfs -x squashfs -x efivarfs;' +
			'echo "NET_INFO:"; cat /proc/net/dev | grep -v "lo:" | grep ":";',
			5
		)
			.then(async result => {
				const timestamp = Math.floor(Date.now() / 1000);
				const lines = result.stdout.split('\n');
				let group = null,
					cpu_threads = 0,
					metrics = {
						host: this.host,
						connected: true,
						cpu_usage: 0,
						load_1m: 0.0,
						load_5m: 0.0,
						load_15m: 0.0,
						memory_total: 0,
						memory_used: 0,
						memory_free: 0,
						memory_shared: 0,
						memory_cache: 0,
						disks_used: 0,
						disks_free: 0,
						disks_total: 0,
						net_total_rx: 0,
						net_total_tx: 0,
						net_rx: 0,
						net_tx: 0,
					};

				lines.forEach(line => {
					if (group === null && line.startsWith('THREAD_COUNT: ')) {
						cpu_threads = parseInt(line.replace('THREAD_COUNT:', '').trim());
					}
					else if (group === null && line.startsWith('UPTIME: ')) {
						const uptimeStr = line.replace('UPTIME:', '').trim();
						const loadMatch = uptimeStr.match(/load average: ([0-9.]+), ([0-9.]+), ([0-9.]+)/);
						if (loadMatch) {
							metrics.load_1m = parseFloat(loadMatch[1]);
							metrics.load_5m = parseFloat(loadMatch[2]);
							metrics.load_15m = parseFloat(loadMatch[3]);
						}
					}
					else if (group === null && line.startsWith('MEMORY_STATS: ')) {
						const memParts = line.replace('MEMORY_STATS:', '').trim().split(' ');
						if (memParts.length === 6) {
							metrics.memory_total = parseInt(memParts[0]) * 1024;
							metrics.memory_used = parseInt(memParts[1]) * 1024;
							metrics.memory_free = parseInt(memParts[2]) * 1024;
							metrics.memory_shared = parseInt(memParts[3]) * 1024;
							metrics.memory_cache = parseInt(memParts[4]) * 1024;
						}
					}
					else if (line === 'DISK_INFO:') {
						group = 'disks';
					}
					else if (line === 'NET_INFO:') {
						group = 'nics';
					}
					else if (group === 'disks' && !line.startsWith('Filesystem')) {
						const parts = line.trim().split(/\s+/);
						if (parts.length === 3) {
							let disk = parts[0],
								used = parseInt(parts[1]) * 1024,
								avail = parseInt(parts[2]) * 1024;

							metrics.disks_used += used;
							metrics.disks_free += avail;
							metrics.disks_total += (used + avail);
							metrics[`disk_${disk}_used`] = used;
							metrics[`disk_${disk}_free`] = avail;
							metrics[`disk_${disk}_total`] = (used + avail);
						}
					}
					else if (group === 'nics') {
						let statParts = line.trim().split(/\s+/);
						if (statParts.length >= 17) {
							let nicRx = parseInt(statParts[1]),
								nicTx = parseInt(statParts[9]);

							metrics.net_total_rx += nicRx;
							metrics.net_total_tx += nicTx;
						}
					}
				});

				if (cpu_threads > 0 && metrics.load_1m > 0) {
					metrics.cpu_usage = parseFloat(((metrics.load_1m / cpu_threads) * 100).toFixed(2));
				}

				// Lookup the last RX/TX values from the database to calculate deltas
				const lastMetric = await HostMetric.findOne({
					where: {ip: this.host},
					order: [['timestamp', 'DESC']]
				});

				if (lastMetric) {
					if (lastMetric.timestamp && lastMetric.timestamp < timestamp && lastMetric.rx_last && lastMetric.rx_last <= metrics.net_total_rx) {
						metrics.net_rx = parseInt((metrics.net_total_rx - lastMetric.rx_last) / (timestamp - lastMetric.timestamp));
					}
					if (lastMetric.timestamp && lastMetric.timestamp < timestamp && lastMetric.tx_last && lastMetric.tx_last <= metrics.net_total_tx) {
						metrics.net_tx = parseInt((metrics.net_total_tx - lastMetric.tx_last) / (timestamp - lastMetric.timestamp));
					}
				}

				// Store metrics from this discovery if this data is at least a minute old.
				if (!lastMetric || timestamp - lastMetric.timestamp >= 60) {
					HostMetric.create({
						ip: this.host,
						timestamp: timestamp,
						cpu: metrics.cpu_usage,
						memory: metrics.memory_used,
						disk: metrics.disks_used,
						rx_last: metrics.net_total_rx,
						rx: metrics.net_rx,
						tx_last: metrics.net_total_tx,
						tx: metrics.net_tx
					}).catch(err => {
						// Ignore errors here
						console.error('Error storing host metrics for', this.host, err);
					});
				}

				return metrics;
			})
			.catch(e => {
				logger.error(`Failed to retrieve host metrics for ${this.host}: ${e.message}`);
				return {
					host: this.host,
					connected: false,
				}
			});
	}

	/**
	 * Get a list of installed applications on the host
	 *
	 * @returns {Promise<AppInstallData[]>}
	 */
	async getInstalls() {
		const cmd = 'for file in /var/lib/warlock/*.app; do if [ -f "$file" ]; then echo "$(basename "$file" ".app"):$(cat "$file")"; fi; done';

		return cmdRunner(this.host, cmd, 86400)
			.then(async result => {
				let installs = [],
					lookups = [];

				for (let line of result.stdout.split('\n')) {
					if (line.trim()) {
						let [guid, path] = line.split(':').map(s => s.trim());

						const hostAppData = new AppInstallData(this.host, path.trim());
						// Load the appdata with some info from the application config
						hostAppData.guid = guid;
						// Initialize the install to retrieve its meta information from the server.
						lookups.push(
							hostAppData
								.init()
								.then(() => {
									installs.push(hostAppData);
								})
								.catch(e => {
									logger.error(`Error initializing AppInstallData for app '${guid}' on host '${this.host}': ${e.message}`);
								})
						);
					}
				}

				await Promise.allSettled(lookups);

				return installs;
			}).catch(e => {
				// Failing to fetch list of apps from server usually indicates a connection error on the host.
				return [];
			});
	}
}
