import {cmdRunner} from "./cmd_runner.mjs";
import {HostMetric} from "../db.js";
import {logger} from "./logger.mjs";

export async function getHostMetrics(host) {
	return new Promise((resolve, reject) => {
		let hostInfo = {
			ip: host,
			public_ip: '',
			connected: false,
			hostname: '',
			os: {
				name: '',
				title: '',
				version: '',
				kernel: '',
			},
			cpu: {
				model: '',
				count: 0,
				threads: 0,
				usage: 0,
				load1m: 0,
				load5m: 0,
				load15m: 0,
				topProcesses: [],
			},
			memory: {
				total: 0,
				used: 0,
				free: 0,
				shared: 0,
				cache: 0,
				topProcesses: [],
			},
			net: {
				rx: 0,
				tx: 0,
			},
			disks: [],
			nics: []
		},
			totalRx = 0,
			totalTx = 0;

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
	});
}
