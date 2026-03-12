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
		this.hostname = null;
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
		this.memory = null;
		this.disks = [];
		this.nics = [];
	}

	async init() {
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
			'echo "DISK_INFO:"; df --output=source,fstype,target -x tmpfs -x devtmpfs -x squashfs -x efivarfs;' +
			'echo "NET_INFO:"; cat /proc/net/dev | grep -v "lo:" | grep ":" | sed "s#:.*##";',
			null, 86400
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
				});

				// Number of cores will be *per socket*, so to get the total number, multiply the two
				if (this.cpu.sockets && this.cpu.cores) {
					this.cpu.cores = this.cpu.sockets * this.cpu.cores;
				}
			})
			.catch(error => {
				throw new Error(`Failed to retrieve host data: ${error}`);
			});
	}

	async _metrics_todo() {
		cmdRunner(
			host,
			'echo "HOSTNAME: $(hostname -f)"; ' +
			'echo "KERNEL: $(uname -r)"; ' +
			'echo "UPTIME: $(uptime)"; ' +
			'echo "THREAD_COUNT: $(nproc)"; ' +
			'echo "PUBLIC_IPV4: $(curl -4 -s ifconfig.me 2>/dev/null || wget -qO- ifconfig.me 2>/dev/null || echo)"; ' +
			'echo "CPU_COUNT: $(egrep "^physical id" /proc/cpuinfo | uniq | wc -l)"; ' +
			'echo "CPU_CORES_PER_SOCKET: $(egrep "^cpu cores" /proc/cpuinfo | head -n1 | sed "s#.*: ##")"; ' +
			'echo "CPU_MODEL: $(egrep "^model name" /proc/cpuinfo | head -n1 | sed "s#.*: ##")"; ' +
			'echo "MEMORY_STATS: $(free | grep "^Mem:" | tr -s " " | cut -d" " -f2,3,4,5,6,7)"; ' +
			'echo "TOP_CPU_PROCESSES:"; ps aux --sort=-%cpu | head -6 | tail -5 | awk "{print \\$11}"; ' +
			'echo "TOP_MEMORY_PROCESSES:"; ps aux --sort=-%mem | head -6 | tail -5 | awk "{print \\$11}"; ' +
			'echo "OS_INFO:"; lsb_release -a; ' +
			'echo "DISK_INFO:"; df --output=source,fstype,used,avail,target -x tmpfs -x devtmpfs -x squashfs -x efivarfs;' +
			'echo "NET_INFO:"; cat /proc/net/dev | grep -v "lo:" | grep ":";'
		)
			.then(result => {
				const timestamp = Math.floor(Date.now() / 1000);
				const lines = result.stdout.split('\n');
				let group = null;

				hostInfo.connected = true;
				lines.forEach(line => {
					if (line.startsWith('HOSTNAME:')) {
						hostInfo.hostname = line.replace('HOSTNAME:', '').trim();
						group = null;
					}
					else if (group === null && line.startsWith('THREAD_COUNT: ')) {
						hostInfo.cpu.threads = parseInt(line.replace('THREAD_COUNT:', '').trim());
					}
					else if (group === null && line.startsWith('PUBLIC_IPV4: ')) {
						hostInfo.public_ip = line.replace('PUBLIC_IPV4:', '').trim();
					}
					else if (group === null && line.startsWith('CPU_COUNT: ')) {
						hostInfo.cpu.count = parseInt(line.replace('CPU_COUNT:', '').trim());
					}
					else if (group === null && line.startsWith('CPU_MODEL: ')) {
						hostInfo.cpu.model = line.replace('CPU_MODEL:', '').trim();
					}
					else if (group === null && line.startsWith('UPTIME: ')) {
						const uptimeStr = line.replace('UPTIME:', '').trim();
						const loadMatch = uptimeStr.match(/load average: ([0-9.]+), ([0-9.]+), ([0-9.]+)/);
						if (loadMatch) {
							hostInfo.cpu.load1m = parseFloat(loadMatch[1]);
							hostInfo.cpu.load5m = parseFloat(loadMatch[2]);
							hostInfo.cpu.load15m = parseFloat(loadMatch[3]);
						}
					}
					else if (group === null && line.startsWith('MEMORY_STATS: ')) {
						const memParts = line.replace('MEMORY_STATS:', '').trim().split(' ');
						if (memParts.length === 6) {
							hostInfo.memory.total = parseInt(memParts[0]) * 1024;
							hostInfo.memory.used = parseInt(memParts[1]) * 1024;
							hostInfo.memory.free = parseInt(memParts[2]) * 1024;
							hostInfo.memory.shared = parseInt(memParts[3]) * 1024;
							hostInfo.memory.cache = parseInt(memParts[4]) * 1024;
						}
					}
					else if (group === null && line.startsWith('KERNEL: ')) {
						hostInfo.os.kernel = line.replace('KERNEL:', '').trim();
					}
					else if (line === 'DISK_INFO:') {
						group = 'disks';
					}
					else if (line === 'OS_INFO:') {
						group = 'os';
					}
					else if (line === 'TOP_CPU_PROCESSES:') {
						group = 'top_cpu';
					}
					else if (line === 'TOP_MEMORY_PROCESSES:') {
						group = 'top_memory';
					}
					else if (line === 'NET_INFO:') {
						group = 'nics';
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
					else if (group === 'top_cpu') {
						if (line.trim().length > 0) {
							hostInfo.cpu.topProcesses.push(line.trim());
						}
					}
					else if (group === 'top_memory') {
						if (line.trim().length > 0) {
							hostInfo.memory.topProcesses.push(line.trim());
						}
					}
					else if (group === 'nics') {
						let statParts = line.trim().split(/\s+/);
						if (statParts.length >= 17) {
							let nicName = statParts[0].replace(':', '');
							hostInfo.nics.push({
								name: nicName,
								rx: parseInt(statParts[1]),
								tx: parseInt(statParts[9]),
							});

							totalRx += parseInt(statParts[1]);
							totalTx += parseInt(statParts[9]);
						}
					}
				});

				// Parse CPU_CORES_PER_SOCKET from raw output if present
				const cpuCoresLine = lines.find(l => l && l.startsWith('CPU_CORES_PER_SOCKET:'));
				if (cpuCoresLine) {
					hostInfo.cpu.cores_per_socket = parseInt(cpuCoresLine.replace('CPU_CORES_PER_SOCKET:', '').trim()) || 0;
				}
				// Derive physical core count when possible
				if (hostInfo.cpu.cores_per_socket && hostInfo.cpu.count) {
					hostInfo.cpu.physical_cores = hostInfo.cpu.cores_per_socket * hostInfo.cpu.count;
				} else if (hostInfo.cpu.threads && hostInfo.cpu.count && hostInfo.cpu.count > 0) {
					// fallback estimate
					hostInfo.cpu.physical_cores = Math.floor(hostInfo.cpu.threads / hostInfo.cpu.count);
				} else {
					hostInfo.cpu.physical_cores = 0;
				}

				if (hostInfo.cpu.threads > 0 && hostInfo.cpu.load1m > 0) {
					hostInfo.cpu.usage = parseFloat(((hostInfo.cpu.load1m / hostInfo.cpu.threads) * 100).toFixed(2));
				}

				// Lookup the last RX/TX values from the database to calculate deltas
				HostMetric.findOne({
					where: {ip: hostInfo.ip},
					order: [['timestamp', 'DESC']]
				})
					.then(lastMetric => {
						if (lastMetric) {
							if (lastMetric.timestamp && lastMetric.timestamp < timestamp && lastMetric.rx_last && lastMetric.rx_last <= totalRx) {
								hostInfo.net.rx = parseInt((totalRx - lastMetric.rx_last) / (timestamp - lastMetric.timestamp));
							}
							if (lastMetric.timestamp && lastMetric.timestamp < timestamp && lastMetric.tx_last && lastMetric.tx_last <= totalTx) {
								hostInfo.net.tx = parseInt((totalTx - lastMetric.tx_last) / (timestamp - lastMetric.timestamp));
							}
						}

						// Store metrics from this discovery
						HostMetric.create({
							ip: hostInfo.ip,
							timestamp: timestamp,
							cpu: hostInfo.cpu.usage,
							memory: hostInfo.memory.used,
							disk: hostInfo.disks.reduce((acc, disk) => acc + disk.used, 0),
							rx_last: totalRx,
							rx: hostInfo.net.rx,
							tx_last: totalTx,
							tx: hostInfo.net.tx
						}).catch(err => {
							// Ignore errors here
							console.error('Error storing host metrics for', hostInfo.ip, err);
						});

						resolve(hostInfo);
					})
					.catch(error => {
						// metrics could not be loaded/stored, but still provide data back
						logger.warn(`Error storing host metrics for`, error);
						resolve(hostInfo);
					});

			})
			.catch(error => {
				reject({message: 'Failed to retrieve host metrics', extraFields: {host: host, error: error}});
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
			});
	}
}
